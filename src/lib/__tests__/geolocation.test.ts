import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { requestCoords, geoMessageWithFallback } from '@/lib/geolocation'

// ============================================================================
// Chrome reported "Location access allowed" while the app said "denied", then
// "Unable to determine your location" — with the console showing macOS
// CoreLocation returning kCLErrorLocationUnknown (surfaced as
// POSITION_UNAVAILABLE). That condition is frequently TRANSIENT on a Mac, which
// locates by scanning Wi-Fi, so it is worth asking again before giving up.
//
// A refusal is not transient and must never be retried.
// ============================================================================

const ROOT = join(__dirname, '../..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

const DENIED = 1, UNAVAILABLE = 2, TIMEOUT = 3
const err = (code: number, message = 'x') =>
  ({ code, message, PERMISSION_DENIED: DENIED, POSITION_UNAVAILABLE: UNAVAILABLE, TIMEOUT }) as GeolocationPositionError
const pos = (latitude: number, longitude: number) =>
  ({ coords: { latitude, longitude, accuracy: 12 } }) as GeolocationPosition

let calls: PositionOptions[] = []
const install = (answers: (GeolocationPosition | GeolocationPositionError)[]) => {
  let i = 0
  Object.defineProperty(globalThis.navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition: (ok: PositionCallback, bad: PositionErrorCallback, options: PositionOptions) => {
        calls.push(options)
        const a = answers[Math.min(i++, answers.length - 1)]
        setTimeout(() => ('coords' in a ? ok(a as GeolocationPosition) : bad(a as GeolocationPositionError)), 0)
      },
    },
  })
}

beforeEach(() => { calls = []; vi.spyOn(console, 'warn').mockImplementation(() => {}) })
afterEach(() => vi.restoreAllMocks())

describe('a fix is returned as coordinates, with no Maps involved', () => {
  it('success gives latitude and longitude', async () => {
    install([pos(31.2536, 75.7033)])
    const r = await requestCoords({ retryDelayMs: 0 })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.latitude).toBe(31.2536)
    expect(r.longitude).toBe(75.7033)
    expect(r.accuracy).toBe(12)
    expect(calls).toHaveLength(1)
  })

  it('the helper never mentions Google Maps — geocoding is the caller\'s job', () => {
    // Code only — the header comment explains the split and mentions it.
    const code = read('lib/geolocation.ts').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    expect(code).not.toMatch(/google/i)
    expect(code).not.toMatch(/Geocoder/)
  })
})

describe('kCLErrorLocationUnknown is retried; a refusal is not', () => {
  it('POSITION_UNAVAILABLE is retried and can then succeed', async () => {
    install([err(UNAVAILABLE, 'kCLErrorLocationUnknown'), err(UNAVAILABLE), pos(1, 2)])
    const r = await requestCoords({ retryDelayMs: 0 })
    expect(r.ok).toBe(true)
    if (r.ok) expect([r.latitude, r.longitude]).toEqual([1, 2])
    expect(calls).toHaveLength(3)
  })

  it('and gives up after the configured attempts', async () => {
    install([err(UNAVAILABLE, 'kCLErrorLocationUnknown')])
    const r = await requestCoords({ retries: 2, retryDelayMs: 0 })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.kind).toBe('UNAVAILABLE')
    expect(r.message).toBe('Unable to determine your location.')
    expect(r.attempts).toBe(3)
    expect(calls).toHaveLength(3)
  })

  it('PERMISSION_DENIED is answered immediately — never retried', async () => {
    install([err(DENIED)])
    const r = await requestCoords({ retries: 5, retryDelayMs: 0 })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.kind).toBe('DENIED')
    expect(calls).toHaveLength(1)   // a refusal is an answer, not a hiccup
  })

  it('TIMEOUT is not retried either', async () => {
    install([err(TIMEOUT)])
    const r = await requestCoords({ retries: 5, retryDelayMs: 0 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.kind).toBe('TIMEOUT')
    expect(calls).toHaveLength(1)
  })

  it('the last attempt drops high accuracy, to get a coarse fix rather than none', async () => {
    install([err(UNAVAILABLE)])
    await requestCoords({ retries: 2, retryDelayMs: 0 })
    expect(calls.map((c) => c.enableHighAccuracy)).toEqual([true, true, false])
  })

  it('the raw error is logged, so the real cause is visible in DevTools', async () => {
    install([err(UNAVAILABLE, 'kCLErrorLocationUnknown')])
    await requestCoords({ retries: 0, retryDelayMs: 0 })
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('kCLErrorLocationUnknown'))
  })

  it('reports the raw code and message for diagnosis', async () => {
    install([err(UNAVAILABLE, 'kCLErrorLocationUnknown')])
    const r = await requestCoords({ retries: 0, retryDelayMs: 0 })
    if (!r.ok) expect(r.detail).toBe('code 2: kCLErrorLocationUnknown')
  })
})

describe('"denied" means denied', () => {
  it('only PERMISSION_DENIED produces it', async () => {
    for (const [code, expected] of [[DENIED, 'DENIED'], [UNAVAILABLE, 'UNAVAILABLE'], [TIMEOUT, 'TIMEOUT']] as const) {
      install([err(code)])
      const r = await requestCoords({ retries: 0, retryDelayMs: 0 })
      if (!r.ok) expect(r.kind).toBe(expected)
    }
  })

  it('an unsupported browser is not a refusal', async () => {
    Object.defineProperty(globalThis.navigator, 'geolocation', { configurable: true, value: undefined })
    const r = await requestCoords({ retryDelayMs: 0 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.kind).toBe('UNSUPPORTED')
  })

  it('every message names a fallback the user can actually use', () => {
    const f = { ok: false as const, kind: 'UNAVAILABLE' as const, message: 'Unable to determine your location.', detail: '', attempts: 3 }
    expect(geoMessageWithFallback(f, 'store')).toContain('Search for the store or drop a pin instead.')
    expect(geoMessageWithFallback(f, 'address')).toContain('Search for your address or drop a pin instead.')
  })
})

describe('all three pickers use the one helper', () => {
  const FILES = [
    'components/shared/google/store-location-picker.tsx',
    'components/storefront/web/google/address-picker.tsx',
    'components/storefront/web/delivery-address-sheet.tsx',
  ]

  it('none of them calls getCurrentPosition itself any more', () => {
    for (const f of FILES) {
      const src = read(f)
      expect(src).toContain('requestCoords')
      expect(src).not.toContain('navigator.geolocation.getCurrentPosition(\n')
    }
  })

  it('and none of them hardcodes a denial', () => {
    for (const f of FILES) {
      expect(read(f)).not.toContain('setError("Location access denied')
    }
  })

  it('coordinates are obtained BEFORE any geocoding', () => {
    const store = read('components/shared/google/store-location-picker.tsx')
    const fn = store.slice(store.indexOf('const useMyLocation'), store.indexOf('const noKey'))
    expect(fn.indexOf('await requestCoords()')).toBeLessThan(fn.indexOf('applyLocation('))
  })
})
