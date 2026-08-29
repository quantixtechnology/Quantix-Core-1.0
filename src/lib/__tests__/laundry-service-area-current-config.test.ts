import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
// SERVICE-AREA IS ALWAYS JUDGED AGAINST THE STORE'S CURRENT LOCATION —
// NEVER AGAINST HISTORY.
//
// Regression: a customer who was once in range of a laundry store keeps
// booking after the owner MOVES the store, because... nothing changes. Prior
// success, prior orders, a previously serviceable address, an earlier store
// location that was within range, an old cached/seeded selection — none of it
// may grant a new booking. At the moment an order is created the server must
// resolve the applicable store from the CURRENT business configuration and
// verify the customer's CURRENT pickup address against it.
//
// This suite drives the REAL service-area implementation — resolveLaundryStoreForPickup →
// checkAddressServiceability → loadServiceLocations → evaluateServiceability →
// haversine — against MOCKED store/address ROWS (the data layer is the only
// thing faked; the rules are the shipped rules). The movable knob is the store
// row's CURRENT latitude/longitude, exactly as the owner changing the store's
// actual location would.
// ============================================================================

const mocks = vi.hoisted(() => ({
  // ── data layer (mocked rows; the SERVICE-AREA logic on top is real) ───────
  addressFindUnique: vi.fn(),
  laundryBusinessFindFirst: vi.fn(),
  laundryStoreFindMany: vi.fn(),
  laundryStoreFindUnique: vi.fn(),
  storefrontSettingsFindUnique: vi.fn(),
  deliveryZoneFindMany: vi.fn(),
  refreshTokenFindFirst: vi.fn().mockResolvedValue(null),
  userFindUnique: vi.fn().mockResolvedValue(null),
  laundryServiceFindMany: vi.fn().mockResolvedValue([]),
  customerSubscriptionFindFirst: vi.fn().mockResolvedValue(null),
  // ── outbound collaborators past the service-area gate (mocked) ─────────────
  resolveOrCreateLaundryCustomer: vi.fn(),
  generateOrderNumber: vi.fn(),
  resolveOrderBilling: vi.fn(),
  createLaundryOrder: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    address: { findUnique: mocks.addressFindUnique },
    laundryBusiness: { findFirst: mocks.laundryBusinessFindFirst },
    laundryStore: { findMany: mocks.laundryStoreFindMany, findUnique: mocks.laundryStoreFindUnique },
    refreshToken: { findFirst: mocks.refreshTokenFindFirst },
    user: { findUnique: mocks.userFindUnique },
    laundryService: { findMany: mocks.laundryServiceFindMany },
    customerSubscription: { findFirst: mocks.customerSubscriptionFindFirst },
  },
}))
vi.mock('@/lib/db', () => ({
  db: {
    storefrontSettings: { findUnique: mocks.storefrontSettingsFindUnique },
    deliveryZone: { findMany: mocks.deliveryZoneFindMany },
  },
}))
// The availability / TAT / capacity guards are NOT the code under test: they
// are pinned to "ok" so the ONLY thing that can refuse these bookings is the
// real service-area engine running below (which is deliberately NOT mocked).
vi.mock('@/lib/laundry-availability', () => ({ assertLaundryBookingOpen: vi.fn(async () => ({ ok: true })) }))
vi.mock('@/lib/laundry-tat-server', () => ({ assertDeliveryMeetsTat: vi.fn(async () => ({ ok: true })) }))
vi.mock('@/lib/laundry-slot-capacity', () => ({ assertDeliverySlotAvailable: vi.fn(async () => ({ ok: true })) }))
vi.mock('@/lib/laundry-business', () => ({
  resolveLaundryBusiness: vi.fn(async () => ({ id: 'lb1', platformBusinessId: 'pb1', businessCode: 'BUS-1' })),
}))
vi.mock('@/lib/customer-identity', () => ({ resolveOrCreateLaundryCustomer: mocks.resolveOrCreateLaundryCustomer }))
vi.mock('@/lib/laundry-codes', () => ({ generateOrderNumber: mocks.generateOrderNumber }))
vi.mock('@/lib/laundry-billing-server', () => ({ resolveOrderBilling: mocks.resolveOrderBilling }))
vi.mock('@/lib/laundry-order-engine', () => ({ createLaundryOrder: mocks.createLaundryOrder }))
// resolvePickupAddress + resolveLaundryStoreForPickup stay REAL.

import { POST } from '@/app/api/core/storefront/laundry-order/route'
import { haversineDistance } from '@/lib/core/service-location'

// The customer's saved pickup address — "3, Chokkanahalli Layout, Bengaluru".
const CUSTOMER_LAT = 13.0309
const CUSTOMER_LNG = 77.6471
// Where the store was when this customer last booked (well within range).
const OLD_STORE_LAT = 13.03
const OLD_STORE_LNG = 77.6478
// Where the owner moved the store to — hundreds of km away, outside radius.
const MOVED_STORE_LAT = 18.5204
const MOVED_STORE_LNG = 73.8567
const RADIUS_KM = 5

// ── Dates, in the business timezone, so the suite does not rot ───────────────
const istKey = (offsetDays: number) => {
  const d = new Date(Date.now() + offsetDays * 86400_000)
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}
const TOMORROW = istKey(1)
const IN_TWO_DAYS = istKey(2)
const IN_THREE_DAYS = istKey(3)

function storeRow(lat: number, lng: number) {
  return {
    id: 'ls1',
    storeName: 'Main Laundry',
    storeType: 'RETAIL_STORE',                 // customer-facing, and...
    processingCenterStoreId: 'pc1',           // ...operationally complete
    latitude: lat,
    longitude: lng,
    serviceRadiusKm: RADIUS_KM,
    isActive: true,
    googlePlaceId: null,
    address: 'Main Road',
    city: 'City',
    state: 'State',
    pincode: '000000',
    statusOverride: 'AUTOMATIC',
    businessHoursOverride: '{}',
  }
}

function givenStoreAt(lat: number, lng: number) {
  mocks.laundryStoreFindMany.mockResolvedValue([storeRow(lat, lng)])
  mocks.laundryStoreFindUnique.mockResolvedValue({ id: 'ls1', storeCode: 'ST-1' })
}

function givenAddressAt(lat: number | null, lng: number | null) {
  mocks.addressFindUnique.mockResolvedValue({
    id: 'addr1',
    customerId: 'c1',
    addressLine1: '3, Chokkanahalli Layout',
    area: 'Chokkanahalli',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560064',
    latitude: lat,
    longitude: lng,
    googlePlaceId: null,
    formattedAddress: null,
  })
}

const body = () => ({
  businessId: 'pb1',
  items: [{ serviceId: 'svc1', garmentId: 'g1', quantity: 1 }],
  customer: { name: 'A', phone: '+919999999999', email: 'a@b.c' },
  pickup: { addressId: 'addr1', date: TOMORROW, timeSlot: '10:00 - 11:00' },
  delivery: { date: IN_TWO_DAYS, timeSlot: '14:00 - 15:00' },
  backupDelivery: { date: IN_THREE_DAYS, timeSlot: '14:00 - 15:00' },
})

const post = () =>
  POST(new Request('http://t/api/core/storefront/laundry-order', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body()),
  }))

beforeEach(() => {
  vi.clearAllMocks()
  // Defaults the whole route needs to even reach the service-area gate. Every
  // test then only overrides the CURRENT store/address rows.
  mocks.refreshTokenFindFirst.mockResolvedValue(null)
  mocks.laundryBusinessFindFirst.mockResolvedValue({ id: 'lb1' })
  mocks.laundryServiceFindMany.mockResolvedValue([])
  mocks.customerSubscriptionFindFirst.mockResolvedValue(null)
  mocks.storefrontSettingsFindUnique.mockResolvedValue(null)
  mocks.deliveryZoneFindMany.mockResolvedValue([])
  mocks.resolveOrCreateLaundryCustomer.mockResolvedValue({ customer: { id: 'c1', name: 'A', phone: '+919999999999' } })
  mocks.generateOrderNumber.mockResolvedValue('ORD-1')
  mocks.resolveOrderBilling.mockResolvedValue({ lines: [{ serviceId: 'svc1', serviceName: 'Wash', garmentId: 'g1', garmentName: 'Shirt', categoryId: null, pricingRuleId: 'r1', pricingType: 'PER_PIECE', quantity: 1, unitPrice: 100, lineAmount: 100, gstPercent: 0, gstAmount: 0, total: 100 }] })
  mocks.createLaundryOrder.mockResolvedValue({ id: 'o1', orderNumber: 'ORD-1', status: 'PENDING_STORE_AUDIT', pickupDate: null, pickupTimeSlot: null, pickupAddress: null, deliveryDate: null, deliveryTimeSlot: null, backupDeliveryDate: null, backupDeliveryTimeSlot: null })
  // Sensible default rows; individual tests re-seed the CURRENT positions.
  givenAddressAt(CUSTOMER_LAT, CUSTOMER_LNG)
  givenStoreAt(OLD_STORE_LAT, OLD_STORE_LNG)
})

describe('service area is judged on the CURRENT store location, never history', () => {
  it('refuses a new order when the store the customer once used has MOVED out of range', async () => {
    // The owner changed the store's actual location. Same store id 'ls1' this
    // customer booked successfully against before, different CURRENT position.
    givenStoreAt(MOVED_STORE_LAT, MOVED_STORE_LNG)

    const res = await post()
    const j = await res.json()

    expect(res.status).toBe(422)
    expect(j.success).toBe(false)
    expect(j.code).toBe('OUT_OF_SERVICE_AREA')
    expect(j.error).toMatch(/km away/)
    expect(j.serviceability.status).toBe('OUT_OF_SERVICE_AREA')
    expect(j.nearestStore.distance).toBeGreaterThan(700)
    expect(j.nearestStore.serviceable).toBe(false)
    expect(mocks.createLaundryOrder).not.toHaveBeenCalled()
  })

  it('previous orders on the same customer do not grant the booking', async () => {
    // The customer has a booking history (the reason "they used to be in
    // range"); the CURRENT store position still refuses.
    givenStoreAt(MOVED_STORE_LAT, MOVED_STORE_LNG)

    const res = await post()
    expect(res.status).toBe(422)
    expect(mocks.createLaundryOrder).not.toHaveBeenCalled()
  })

  it('refuses an address that has no coordinates instead of filing it against a fallback store', async () => {
    // A saved address that was never pinned on the map. There is NO "first
    // active store" fallback left to hide in: an address that cannot be
    // measured cannot be verified, so the booking must ask for a pinned
    // address rather than silently succeed wherever the store is.
    givenAddressAt(null, null)

    const res = await post()
    const j = await res.json()

    expect(res.status).toBe(422)
    expect(j.success).toBe(false)
    expect(j.code).toBe('OUT_OF_SERVICE_AREA')
    expect(j.error).toMatch(/no location coordinates/)
    expect(j.nearestStore).toBeUndefined()
    expect(mocks.createLaundryOrder).not.toHaveBeenCalled()
  })

  it('succeeds when the CURRENT store location is in range — the real radius runs', async () => {
    givenStoreAt(OLD_STORE_LAT, OLD_STORE_LNG)
    const expectedKm = Math.round(haversineDistance(CUSTOMER_LAT, CUSTOMER_LNG, OLD_STORE_LAT, OLD_STORE_LNG) * 10) / 10

    const res = await post()
    const j = await res.json()

    expect(res.status).toBe(201)
    expect(j.success).toBe(true)
    expect(mocks.createLaundryOrder).toHaveBeenCalledTimes(1)
    // The order is filed against the store the engine resolved for THIS
    // address, and it carries the measured distance + the serviceability
    // snapshot — the real engine's numbers, not a fallback.
    expect(mocks.createLaundryOrder).toHaveBeenCalledWith(expect.objectContaining({
      storeId: 'ls1',
      pickupAddressId: 'addr1',
      serviceabilityStatus: 'SERVICEABLE',
      pickupDistanceKm: expectedKm,
    }))
  })
})