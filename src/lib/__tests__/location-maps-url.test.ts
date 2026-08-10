import { describe, it, expect } from 'vitest'
import { locationMapsUrl } from '@/lib/delivery-actions'

// ============================================================================
// This function decides where a QR printed on a visiting card sends a customer.
// A wrong answer is expensive in a way a wrong screen is not — the card is
// already in someone's wallet — so it refuses anything it cannot trust rather
// than producing a plausible link.
// ============================================================================

describe('a valid pin', () => {
  it('builds the universal place URL from coordinates', () => {
    expect(locationMapsUrl(13.079394, 77.634063))
      .toBe('https://www.google.com/maps/search/?api=1&query=13.079394,77.634063')
  })

  it('is deterministic — the same pin always gives the same destination', () => {
    expect(locationMapsUrl(13.079394, 77.634063)).toBe(locationMapsUrl(13.079394, 77.634063))
  })

  it('changes when the pin moves, so a saved edit repoints the QR', () => {
    expect(locationMapsUrl(13.079394, 77.634063)).not.toBe(locationMapsUrl(12.9716, 77.5946))
  })

  it('keeps two different stores pointing at different places', () => {
    const thanisandra = locationMapsUrl(13.079394, 77.634063)
    const sector2 = locationMapsUrl(12.9352, 77.6245)
    expect(thanisandra).not.toBe(sector2)
  })

  it('accepts southern and western hemispheres', () => {
    expect(locationMapsUrl(-33.8688, 151.2093)).toContain('query=-33.8688,151.2093')
    expect(locationMapsUrl(40.7128, -74.006)).toContain('query=40.7128,-74.006')
  })

  it('accepts the extremes of the valid range', () => {
    expect(locationMapsUrl(90, 180)).not.toBeNull()
    expect(locationMapsUrl(-90, -180)).not.toBeNull()
  })
})

// Every one of these must produce no QR at all rather than a wrong one.
describe('anything untrustworthy is refused', () => {
  it('refuses missing coordinates', () => {
    expect(locationMapsUrl(null, null)).toBeNull()
    expect(locationMapsUrl(undefined, undefined)).toBeNull()
    expect(locationMapsUrl(13.079394, null)).toBeNull()
    expect(locationMapsUrl(null, 77.634063)).toBeNull()
  })

  // 0,0 is in the Atlantic. In practice it means "never set".
  it('refuses Null Island', () => {
    expect(locationMapsUrl(0, 0)).toBeNull()
  })

  it('accepts a genuine zero on one axis only', () => {
    expect(locationMapsUrl(0, 77.634063)).not.toBeNull()
    expect(locationMapsUrl(13.079394, 0)).not.toBeNull()
  })

  it('refuses out-of-range values', () => {
    expect(locationMapsUrl(91, 0)).toBeNull()
    expect(locationMapsUrl(0, 181)).toBeNull()
    expect(locationMapsUrl(-90.1, 0)).toBeNull()
  })

  it('refuses NaN and Infinity, which parseFloat of an empty field produces', () => {
    expect(locationMapsUrl(NaN, NaN)).toBeNull()
    expect(locationMapsUrl(Infinity, 77)).toBeNull()
    expect(locationMapsUrl(parseFloat(''), parseFloat(''))).toBeNull()
  })
})

describe('the URL form', () => {
  it('uses the api=1 universal syntax, so phones open the Maps app', () => {
    const url = locationMapsUrl(13.079394, 77.634063)!
    expect(url).toContain('api=1')
    expect(url.startsWith('https://www.google.com/maps/search/')).toBe(true)
  })

  // navigateToLocation() builds /maps/dir/ for a driver mid-round. A QR on a
  // card wants the place, not a route from wherever the scanner is standing.
  it('points at the place, not at directions', () => {
    expect(locationMapsUrl(13.079394, 77.634063)).not.toContain('/maps/dir/')
  })
})
