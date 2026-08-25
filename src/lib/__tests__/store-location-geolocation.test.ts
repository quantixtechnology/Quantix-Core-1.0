import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// ============================================================================
// Chrome said "Location access allowed"; the Store Edit screen said "Location
// access denied". Both were right about what they were reporting — the error
// callback ignored its argument, so EVERY geolocation failure was announced as
// a permission refusal. A high-accuracy fix that merely timed out (routine on a
// desktop) read as "denied", and the message then sat there until a reload.
// ============================================================================

const SRC = readFileSync(
  join(__dirname, '../../components/shared/google/store-location-picker.tsx'),
  'utf8',
)
const fn = SRC.slice(SRC.indexOf('const useMyLocation'), SRC.indexOf('const noKey'))

describe('geolocation failures are told apart', () => {
  it('the error callback receives and inspects the error', () => {
    expect(fn).toContain('(err) => {')
    expect(fn).toContain('switch (err.code)')
    // The bug: a callback that took no argument and assumed denial.
    expect(fn).not.toMatch(/\(\)\s*=>\s*\{\s*setLocating\(false\)\s*setError\("Location access denied/)
  })

  it('each documented code gets its own message', () => {
    expect(fn).toContain('case err.PERMISSION_DENIED:')
    expect(fn).toContain('Location access denied.')
    expect(fn).toContain('case err.POSITION_UNAVAILABLE:')
    expect(fn).toContain('Unable to determine your location.')
    expect(fn).toContain('case err.TIMEOUT:')
    expect(fn).toContain('Location request timed out.')
    expect(fn).toContain('default:')
  })

  it('"denied" is reachable ONLY from PERMISSION_DENIED', () => {
    const denied = fn.indexOf('Location access denied.')
    const permCase = fn.indexOf('case err.PERMISSION_DENIED:')
    const nextCase = fn.indexOf('case err.POSITION_UNAVAILABLE:')
    expect(permCase).toBeGreaterThan(-1)
    expect(denied).toBeGreaterThan(permCase)
    expect(denied).toBeLessThan(nextCase)
    // …and it is the only occurrence in the whole function.
    expect(fn.split('Location access denied.').length - 1).toBe(1)
  })
})

describe('no stale state decides the next attempt', () => {
  it('the error is cleared before every request', () => {
    const click = fn.slice(0, fn.indexOf('getCurrentPosition'))
    expect(click).toContain('setError("")')
    expect(click).toContain('setLocating(true)')
  })

  it('nothing caches a permission result — the callback is the only source', () => {
    expect(SRC).not.toContain('permissions.query')
    expect(SRC).not.toContain('PermissionStatus')
    // "denied" appears once, inside the switch. There is no default/initial one.
    expect(SRC.split('Location access denied.').length - 1).toBe(1)
  })

  it('so a granted permission retries normally, with no page refresh', () => {
    // Nothing disables the button on error; only an in-flight request does.
    expect(SRC).toContain('disabled={locating || (!noKey && !mapsReady)}')
  })
})

describe('a successful fix is never discarded', () => {
  it('coordinates are saved even when Maps is not available', () => {
    const ok = fn.slice(fn.indexOf('(pos) => {'), fn.indexOf('(err) => {'))
    expect(ok).toContain('applyLocation(googleRef.current')
    expect(ok).toContain('} else {')
    expect(ok).toContain('onChange({')
    expect(ok).toContain('latitude, longitude,')
  })

  it('with Maps, it centres, marks, reverse geocodes and fills the address', () => {
    const apply = SRC.slice(SRC.indexOf('const applyLocation'), SRC.indexOf('const useMyLocation'))
    expect(apply).toContain('setCenter({ lat, lng })')
    expect(apply).toContain('setPosition({ lat, lng })')
    expect(apply).toContain('new google.maps.Geocoder()')
    expect(apply).toContain('city,')
    expect(apply).toContain('pincode,')
  })

  it('a recent fix is reused, and the timeout is long enough to get one', () => {
    expect(fn).toContain('enableHighAccuracy: true, timeout: 15000, maximumAge: 60000')
  })
})

describe('the button says what it is doing, and manual entry is independent', () => {
  it('shows progress while locating', () => {
    expect(SRC).toContain('{locating ? "Getting your location…" : "Use My Location"}')
  })

  it('search and pin placement do not depend on geolocation', () => {
    // The error is a message under the control; PlacesSearch and the map render
    // regardless of it, so a denial never blocks manual entry.
    expect(SRC).toContain('{error && <p className="text-xs text-red-500">{error}</p>}')
    const beforeError = SRC.slice(0, SRC.indexOf('{error && <p'))
    expect(beforeError).toContain('<PlacesSearch')
    expect(beforeError).toContain('mapRef')
  })
})
