import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  hasValidCoordinates,
  resolvePickupLocation,
  isUnpinnedAddress,
  buildStructuredPickupAddress,
  PICKUP_LOCATION_REQUIRED,
  SAVED_PICKUP_LOCATION_REQUIRED,
  UNPINNED_ADDRESS_BADGE,
} from '@/lib/laundry-pickup-location'

// ============================================================================
// A pickup is assigned to a store by MEASURING the distance from the pickup
// address, so an address with no point on the map cannot be booked. The server
// has always refused one (422); the storefront let the customer reach Confirm
// anyway, and — worse — dropped the coordinates of a customer who HAD dropped a
// pin, so a correct address was refused too.
//
// These drive the real rule module. The component itself is a large client tree
// whose data comes from the network, so the wiring into it is pinned by source
// assertions at the bottom (the idiom used by storefront-slot-dropdown).
// ============================================================================

const addr = (id: string, latitude: number | null, longitude: number | null) => ({ id, latitude, longitude })

describe('hasValidCoordinates', () => {
  it('accepts a finite numeric pair', () => {
    expect(hasValidCoordinates(12.9716, 77.5946)).toBe(true)
    expect(hasValidCoordinates(0, 0)).toBe(true) // a service-area question, not a missing-pin one
    expect(hasValidCoordinates(-33.8688, 151.2093)).toBe(true)
  })

  it('rejects null, undefined and NaN — exactly what the server rejects', () => {
    expect(hasValidCoordinates(null, null)).toBe(false)
    expect(hasValidCoordinates(undefined, undefined)).toBe(false)
    expect(hasValidCoordinates(NaN, 77.5946)).toBe(false)
    expect(hasValidCoordinates(12.9716, NaN)).toBe(false)
  })

  it('rejects a half-set pair', () => {
    expect(hasValidCoordinates(12.9716, null)).toBe(false)
    expect(hasValidCoordinates(null, 77.5946)).toBe(false)
  })

  it('rejects Infinity and numeric strings rather than coercing them', () => {
    expect(hasValidCoordinates(Infinity, 77.5946)).toBe(false)
    expect(hasValidCoordinates('12.9716', '77.5946')).toBe(false)
  })
})

// ── Test 3 · saved address WITH coordinates → submission proceeds ────────────
describe('Test 3 · a saved address with coordinates is bookable', () => {
  it('passes and reports the stored point', () => {
    const v = resolvePickupLocation({
      selectedAddressId: 'a1',
      addresses: [addr('a0', null, null), addr('a1', 12.9716, 77.5946)],
      form: {},
    })
    expect(v.ok).toBe(true)
    expect(v.source).toBe('saved')
    expect(v.latitude).toBe(12.9716)
    expect(v.longitude).toBe(77.5946)
    expect(v.reason).toBeUndefined()
  })

  it('reads the SELECTED row, never the form the server will not look at', () => {
    // submit() sends addressId; the server resolves coordinates from that ROW.
    // A form still holding a stale pin must not vouch for an unpinned address.
    const v = resolvePickupLocation({
      selectedAddressId: 'a1',
      addresses: [addr('a1', null, null)],
      form: { latitude: 12.9716, longitude: 77.5946 },
    })
    expect(v.ok).toBe(false)
    expect(v.source).toBe('saved')
  })
})

// ── Test 4 · saved address WITHOUT coordinates → blocked, with a message ─────
describe('Test 4 · a saved address without coordinates is refused before submit', () => {
  it('fails with the actionable saved-address message', () => {
    const v = resolvePickupLocation({
      selectedAddressId: 'a1',
      addresses: [addr('a1', null, null)],
      form: {},
    })
    expect(v.ok).toBe(false)
    expect(v.latitude).toBeNull()
    expect(v.longitude).toBeNull()
    expect(v.reason).toBe(SAVED_PICKUP_LOCATION_REQUIRED)
    expect(v.reason).toMatch(/Choose on map/)
  })

  it('a half-set saved row is refused too', () => {
    expect(resolvePickupLocation({ selectedAddressId: 'a1', addresses: [addr('a1', 12.97, null)] }).ok).toBe(false)
  })

  it('defers to the server when the selected id is not in the loaded list', () => {
    // Cannot be verified locally; refusing here would block a good address on a
    // list that simply has not loaded. The server still catches it.
    const v = resolvePickupLocation({ selectedAddressId: 'ghost', addresses: [addr('a1', 12.97, 77.59)] })
    expect(v.ok).toBe(true)
    expect(v.source).toBe('unknown')
  })
})

// ── Test 2 · inline address WITHOUT coordinates → blocked, with a message ────
describe('Test 2 · an inline address without coordinates is refused before submit', () => {
  it('fails with the actionable inline message', () => {
    const v = resolvePickupLocation({
      selectedAddressId: null,
      addresses: [],
      form: { latitude: undefined, longitude: undefined },
    })
    expect(v.ok).toBe(false)
    expect(v.source).toBe('inline')
    expect(v.reason).toBe(PICKUP_LOCATION_REQUIRED)
    expect(v.reason).toMatch(/map/i)
  })

  it('typed text alone never satisfies the gate — nothing is geocoded', () => {
    const v = resolvePickupLocation({
      form: { addressLine1: '12 MG Road', city: 'Bengaluru', pincode: '560001' } as never,
    })
    expect(v.ok).toBe(false)
    expect(v.latitude).toBeNull()
  })
})

// ── Test 1 · inline address WITH map coordinates reaches the payload ─────────
describe('Test 1 · the inline payload carries the coordinates the picker set', () => {
  const form = {
    label: 'Home',
    addressLine1: '12 MG Road',
    area: 'Ashok Nagar',
    landmark: 'Near Metro',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560001',
    latitude: 12.9716,
    longitude: 77.5946,
    googlePlaceId: 'ChIJbU60yXAWrjsR4E9-UejD3_g',
    formattedAddress: '12 MG Road, Bengaluru, Karnataka 560001',
  }

  it('passes the gate', () => {
    const v = resolvePickupLocation({ selectedAddressId: null, addresses: [], form })
    expect(v.ok).toBe(true)
    expect(v.source).toBe('inline')
    expect(v.latitude).toBe(12.9716)
    expect(v.longitude).toBe(77.5946)
  })

  it('THE REGRESSION: structured carries latitude/longitude, not text alone', () => {
    const structured = buildStructuredPickupAddress(form, { fullName: 'Asha', phone: '9876543210' })
    expect(structured.latitude).toBe(12.9716)
    expect(structured.longitude).toBe(77.5946)
  })

  it('carries the Google identifiers the server also reads', () => {
    const structured = buildStructuredPickupAddress(form)
    expect(structured.googlePlaceId).toBe('ChIJbU60yXAWrjsR4E9-UejD3_g')
    expect(structured.formattedAddress).toBe('12 MG Road, Bengaluru, Karnataka 560001')
  })

  it('still carries every text field and the customer identity', () => {
    const structured = buildStructuredPickupAddress(form, { fullName: 'Asha', phone: '9876543210' })
    expect(structured).toMatchObject({
      fullName: 'Asha', phone: '9876543210', label: 'Home',
      addressLine1: '12 MG Road', area: 'Ashok Nagar', landmark: 'Near Metro',
      city: 'Bengaluru', state: 'Karnataka', pincode: '560001',
    })
  })

  it('normalises an unpinned form to null rather than dropping the keys', () => {
    // The keys must EXIST and be null, so "no pin" is stated, not implied by
    // absence — resolvePickupAddress reads `s.latitude ?? null` either way, but
    // an explicit null is what the snapshot and any future logging can see.
    const structured = buildStructuredPickupAddress({ addressLine1: '12 MG Road', city: 'Bengaluru' })
    expect('latitude' in structured).toBe(true)
    expect(structured.latitude).toBeNull()
    expect(structured.longitude).toBeNull()
  })
})

// ── Test 5 · coordinates survive API → state → selection ────────────────────
describe('Test 5 · coordinates survive the saved-address round trip', () => {
  it('a row as the API returns it stays measurable through selection', () => {
    // Shape as GET /api/core/storefront/addresses returns it (full Address row).
    const apiResponse = [{
      id: 'a1', label: 'Home', addressLine1: '12 MG Road', area: 'Ashok Nagar',
      city: 'Bengaluru', state: 'Karnataka', pincode: '560001', country: 'India',
      isDefault: true, latitude: 12.9716, longitude: 77.5946,
    }]
    const selected = apiResponse.find((a) => a.id === 'a1')!
    expect(selected.latitude).toBe(12.9716)
    expect(resolvePickupLocation({ selectedAddressId: 'a1', addresses: apiResponse }).ok).toBe(true)
    expect(isUnpinnedAddress(selected)).toBe(false)
  })

  it('a legacy row with null coordinates is flagged rather than silently booked', () => {
    const legacy = { id: 'a2', addressLine1: '9 Residency Rd', city: 'Bengaluru', pincode: '560025', latitude: null, longitude: null }
    expect(isUnpinnedAddress(legacy)).toBe(true)
    expect(resolvePickupLocation({ selectedAddressId: 'a2', addresses: [legacy] }).ok).toBe(false)
  })

  it('an address whose coordinates were stripped in transit is caught', () => {
    // The defect this fix removes: the row arrives complete, the client keeps
    // only the text. Such an object must read as unpinned, not as fine — so the
    // shape here is an address row whose coordinate keys are simply absent.
    const stripped: { id: string; addressLine1: string; city: string; pincode: string; latitude?: number | null; longitude?: number | null } =
      { id: 'a3', addressLine1: '12 MG Road', city: 'Bengaluru', pincode: '560001' }
    expect(isUnpinnedAddress(stripped)).toBe(true)
  })
})

// ── The wiring into the storefront component ────────────────────────────────
const HOME = readFileSync(join(process.cwd(), 'src/components/storefront/web/storefront-laundry-home.tsx'), 'utf8')

describe('the Customer PWA is wired to the rule', () => {
  it('the Addr type keeps the coordinates the API returns', () => {
    const line = HOME.split('\n').find((l) => l.startsWith('interface Addr '))!
    expect(line).toContain('latitude?: number | null')
    expect(line).toContain('longitude?: number | null')
  })

  it('the inline payload is built by the shared helper, not by hand', () => {
    expect(HOME).toContain('buildStructuredPickupAddress(addrForm, { fullName: name, phone })')
    // The hand-built object that dropped the coordinates is gone.
    expect(HOME).not.toMatch(/const structured = \{ fullName: name, phone, label: addrForm\.label/)
  })

  it('submit() gates on the resolved pickup location', () => {
    expect(HOME).toContain('resolvePickupLocation({ selectedAddressId: selAddr, addresses, form: addrForm })')
    expect(HOME).toContain('if (!pickupLocation.ok) { toast.error(pickupLocation.reason || ""); return }')
  })

  it('the gate returns BEFORE any order request is sent', () => {
    // Tests 2 and 4 require that no POST happens. What guarantees it is the
    // early return sitting above every fetch in submit(), so assert the order.
    const submitBody = HOME.slice(HOME.indexOf('const submit = async'))
    const gateAt = submitBody.indexOf('if (!pickupLocation.ok)')
    expect(gateAt).toBeGreaterThan(-1)
    for (const call of ['/api/core/storefront/laundry-order', '/api/core/storefront/laundry-checkout', '/api/core/storefront/addresses']) {
      const callAt = submitBody.indexOf(call)
      expect(callAt).toBeGreaterThan(-1)
      expect(gateAt).toBeLessThan(callAt)
    }
    // ...and before submitting state is entered at all.
    expect(gateAt).toBeLessThan(submitBody.indexOf('setSubmitting(true)'))
  })

  it('marks an unpinned saved address where it is chosen', () => {
    expect(HOME).toContain('isUnpinnedAddress(a)')
    expect(HOME).toContain('UNPINNED_ADDRESS_BADGE')
    expect(UNPINNED_ADDRESS_BADGE).toBe('Location not set')
  })

  it('never geocodes or guesses a coordinate to get past the gate', () => {
    // Recovering a missing pin by geocoding the text would invent the very
    // measurement the server-side guard exists to demand. No call may do it.
    expect(HOME).not.toMatch(/\bgeocoder?\s*\(/i)
    expect(HOME).not.toMatch(/reverseGeocodeAddress|fetchPlaceDetails|\/geocode/)
    expect(HOME).not.toMatch(/latitude: 0\b/)
  })
})
