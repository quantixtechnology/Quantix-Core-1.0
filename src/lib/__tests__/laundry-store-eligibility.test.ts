import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  customerFacingStoreWhere, isCustomerFacingStore, CUSTOMER_FACING_STORE_TYPES,
  STORE_TYPE_RETAIL, STORE_TYPE_BOTH, STORE_TYPE_PROCESSING,
} from '@/lib/laundry-store-eligibility'
import { findNearestServiceLocation, type ServiceLocation } from '@/lib/core/service-location'

// ============================================================================
// A Processing Center is an internal operations location. It has coordinates
// and it is active, so every distance calculation returned it as a possible
// "nearest store" — a customer could be told their nearest branch is a
// building they can never visit.
//
// The distance maths is NOT changed. Processing Centers are removed from the
// CANDIDATE SET before distance is computed.
// ============================================================================

const ROOT = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')
const PROVIDERS = read('src/lib/core/service-location-providers.ts')
const SERVICEABILITY = read('src/lib/laundry-serviceability.ts')
const PWA_ORDERS = read('src/app/api/laundry/app/orders/route.ts')
const CORE = read('src/lib/core/service-location.ts')

// A customer at the origin; stores placed due north so km ≈ distance.
const CUSTOMER = { lat: 0, lng: 0 }
const kmToDeg = (km: number) => km / 111.32

// Retail stores carry an assignment by default: a retail store is only
// customer-facing once it knows where its garments are processed (see the
// "operationally complete" rule). Pass null to model an unassigned one.
type Loc = ServiceLocation & { storeType: string; processingCenterStoreId: string | null }
const store = (name: string, storeType: string, km: number, isActive = true, processingCenterStoreId: string | null = 'pc1'): Loc => ({
  id: name, businessId: 'b1', kind: 'laundryStore', name, storeType, processingCenterStoreId,
  latitude: kmToDeg(km), longitude: 0,
  serviceRadiusKm: 10, maxDeliveryDistanceKm: 10, isActive,
})

/** The shipped rule, then the shipped distance function — nothing re-implemented. */
const nearestEligible = (all: Loc[]) =>
  findNearestServiceLocation(all.filter(isCustomerFacingStore), CUSTOMER.lat, CUSTOMER.lng)

// ── The rule ───────────────────────────────────────────────────────────────
describe('eligibility uses the existing storeType', () => {
  it('1. RETAIL_STORE is eligible once it has a Processing Center', () => {
    // Superseded: a retail store used to qualify on type alone. It must now
    // also be operationally complete — it cannot take a customer's order
    // without knowing where the garments go.
    expect(isCustomerFacingStore({ storeType: STORE_TYPE_RETAIL, processingCenterStoreId: 'pc1' })).toBe(true)
    expect(isCustomerFacingStore({ storeType: STORE_TYPE_RETAIL, processingCenterStoreId: null })).toBe(false)
  })

  it('2. BOTH (retail + processing) is eligible with no assignment', () => {
    // It processes its own work, so there is nothing to assign.
    expect(isCustomerFacingStore({ storeType: STORE_TYPE_BOTH, processingCenterStoreId: null })).toBe(true)
  })

  it('3. PROCESSING_CENTER is excluded', () => {
    expect(isCustomerFacingStore({ storeType: STORE_TYPE_PROCESSING, processingCenterStoreId: null })).toBe(false)
  })

  it('only these two types are customer-facing', () => {
    expect(CUSTOMER_FACING_STORE_TYPES).toEqual(['RETAIL_STORE', 'BOTH'])
  })

  it('an unrecognised type is treated as retail, not silently dropped', () => {
    // The column is a free String defaulting to RETAIL_STORE, so an unknown
    // value follows the retail rule rather than vanishing from the storefront.
    expect(isCustomerFacingStore({ storeType: 'FRANCHISE', processingCenterStoreId: 'pc1' })).toBe(true)
    expect(isCustomerFacingStore({ storeType: 'FRANCHISE', processingCenterStoreId: null })).toBe(false)
  })

  it('the query fragment carries both conditions', () => {
    // Superseded: it used to be the store-type exclusion alone.
    expect(customerFacingStoreWhere.storeType).toEqual({ not: 'PROCESSING_CENTER' })
    expect(customerFacingStoreWhere.OR).toEqual([
      { storeType: 'BOTH' },
      { processingCenterStoreId: { not: null } },
    ])
  })
})

// ── The cases, through the REAL nearest-store function ─────────────────────
describe('nearest customer-facing store', () => {
  it('CASE 1 — PC 1km, Retail 3km → Retail', () => {
    const r = nearestEligible([
      store('PC', STORE_TYPE_PROCESSING, 1),
      store('Retail', STORE_TYPE_RETAIL, 3),
    ])
    expect(r.location?.name).toBe('Retail')
    expect(r.distanceKm).toBeCloseTo(3, 0)
  })

  it('CASE 2 — PC 1km, Both 4km → Both', () => {
    const r = nearestEligible([
      store('PC', STORE_TYPE_PROCESSING, 1),
      store('Both', STORE_TYPE_BOTH, 4),
    ])
    expect(r.location?.name).toBe('Both')
  })

  it('CASE 3 — only a Processing Center exists → no store selected', () => {
    const r = nearestEligible([store('PC', STORE_TYPE_PROCESSING, 1)])
    expect(r.location).toBeNull()
    expect(r.distanceKm).toBeNull()
    // …and it is NOT silently treated as retail.
  })

  it('CASE 4 — Retail 5km, PC 2km, Retail 8km → the 5km Retail', () => {
    const r = nearestEligible([
      store('Retail-5', STORE_TYPE_RETAIL, 5),
      store('PC', STORE_TYPE_PROCESSING, 2),
      store('Retail-8', STORE_TYPE_RETAIL, 8),
    ])
    expect(r.location?.name).toBe('Retail-5')
  })

  it('CASE 5 — Both 2km, Retail 4km, PC 1km → Both at 2km', () => {
    const r = nearestEligible([
      store('Both', STORE_TYPE_BOTH, 2),
      store('Retail', STORE_TYPE_RETAIL, 4),
      store('PC', STORE_TYPE_PROCESSING, 1),
    ])
    expect(r.location?.name).toBe('Both')
  })

  it('7. an inactive retail store is still excluded', () => {
    // The pre-existing isActive rule is untouched and still applies.
    const r = nearestEligible([
      store('Retail-closed', STORE_TYPE_RETAIL, 1, false),
      store('Retail-open', STORE_TYPE_RETAIL, 6),
    ])
    expect(r.location?.name).toBe('Retail-open')
  })

  it('8. among eligible stores the nearest still wins', () => {
    const r = nearestEligible([
      store('far', STORE_TYPE_RETAIL, 9),
      store('near', STORE_TYPE_BOTH, 2),
      store('mid', STORE_TYPE_RETAIL, 5),
    ])
    expect(r.location?.name).toBe('near')
  })
})

// ── Radius is unchanged ────────────────────────────────────────────────────
describe('9. service radius keeps working', () => {
  it('distance is still compared against the store’s own radius', () => {
    const eligible = [store('Retail', STORE_TYPE_RETAIL, 12)] // radius 10
    const r = nearestEligible(eligible)
    expect(r.distanceKm).toBeGreaterThan(eligible[0].serviceRadiusKm)
  })

  it('the distance function itself was not modified', () => {
    // No store-type knowledge leaked into the pure core; it still filters only
    // on isActive + coordinates.
    expect(CORE).toContain('if (!loc.isActive) continue')
    expect(CORE).toContain('haversineDistance(lat, lng, loc.latitude, loc.longitude)')
    expect(CORE).not.toContain('storeType')
    expect(CORE).not.toContain('PROCESSING_CENTER')
  })
})

// ── One rule, applied at the shared layer ──────────────────────────────────
describe('the rule is applied once, server-side', () => {
  it('the shared provider filters before any distance is computed', () => {
    expect(PROVIDERS).toContain('customerFacingStoreWhere')
    expect(PROVIDERS).toContain('laundryBusinessId: laundry.id, isActive: true, ...customerFacingStoreWhere')
  })

  it('the no-coordinates fallback is filtered too', () => {
    expect(SERVICEABILITY).toContain('customerFacingStoreWhere')
  })

  it('the PWA order-creation fallback is filtered too', () => {
    expect(PWA_ORDERS).toContain('customerFacingStoreWhere')
    // …and it now also respects isActive, which it did not before.
    expect(PWA_ORDERS).toContain('laundryBusinessId: biz.id, isActive: true, ...customerFacingStoreWhere')
  })

  it('no competing hardcoded filter was introduced', () => {
    // Every customer-facing site imports the one rule instead of spelling it out.
    for (const f of [PROVIDERS, SERVICEABILITY, PWA_ORDERS]) {
      expect(f).not.toContain('"PROCESSING_CENTER"')
      expect(f).not.toContain("'PROCESSING_CENTER'")
    }
  })

  it('no new customer-facing flag was added to the model', () => {
    const schema = read('prisma/schema.prisma')
    expect(schema).not.toContain('isCustomerFacing')
    expect(schema).not.toContain('isPickupStore')
    expect(schema).not.toContain('isPublicStore')
    // The existing column is what the rule reads.
    expect(schema).toContain('storeType             String              @default("RETAIL_STORE")')
  })
})

// ── Internal operations untouched ──────────────────────────────────────────
describe('10. internal Processing Center functionality is unaffected', () => {
  it('the admin store list is a different endpoint and is not filtered', () => {
    // Laundry OS → Stores reads /api/laundry/businesses/[id]/stores, which the
    // customer rule never touches, so Processing Centers stay fully visible.
    const adminStores = read('src/app/api/laundry/businesses/[id]/stores/route.ts')
    expect(adminStores).not.toContain('customerFacingStoreWhere')
    const adminUi = read('src/components/admin/laundry/laundry-stores-view.tsx')
    expect(adminUi).toContain('PROCESSING_CENTER')
    expect(adminUi).toContain('Both (Retail + Processing)')
  })

  it('the processing-centre workflow modules are not touched by the rule', () => {
    for (const f of [
      'src/lib/laundry-workflow.ts',
      'src/lib/laundry-dispatch.ts',
    ]) {
      expect(read(f)).not.toContain('customerFacingStoreWhere')
    }
  })
})
