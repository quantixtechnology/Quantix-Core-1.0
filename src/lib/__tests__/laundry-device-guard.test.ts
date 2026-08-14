import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { shouldRestrictToDesktopTablet } from '@/lib/device-class'

// ============================================================================
// A narrow window is not a phone, and a phone is not a problem.
//
// THE BUG: the guard asked only "is the viewport under 768?" and so blocked
// anyone opening the Laundry workspace in Chrome on their phone. That is an
// ordinary responsive website visit. The restriction belongs to the INSTALLED
// app — the controlled terminal a counter runs — and only on a phone.
//
//   the Laundry OS host  ·  installed / standalone  ·  a phone-sized device
//
// All three, or the workspace renders.
// ============================================================================

const ROOT = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

/** Screens, by their SHORTER side — the same in portrait and landscape. */
const PHONE = 390        // iPhone 15
const SMALL_PHONE = 360  // Android
const TABLET = 820       // iPad Air
const ANDROID_TABLET = 800
const DESKTOP = 1080

const laundry = (o: Partial<Parameters<typeof shouldRestrictToDesktopTablet>[0]>) =>
  shouldRestrictToDesktopTablet({ installed: false, shortestScreenSide: DESKTOP, isLaundryOsHost: true, ...o })

// ── The acceptance matrix ─────────────────────────────────────────────────
describe('THE MATRIX — only one cell blocks', () => {
  it('1. Laundry · normal mobile browser → ALLOWED', () => {
    expect(laundry({ installed: false, shortestScreenSide: PHONE })).toBe(false)
    expect(laundry({ installed: false, shortestScreenSide: SMALL_PHONE })).toBe(false)
  })

  it('2. Laundry · normal desktop browser → ALLOWED', () => {
    expect(laundry({ installed: false, shortestScreenSide: DESKTOP })).toBe(false)
  })

  it('3. Laundry · normal tablet browser → ALLOWED', () => {
    expect(laundry({ installed: false, shortestScreenSide: TABLET })).toBe(false)
  })

  it('4. Laundry · INSTALLED PWA · phone → BLOCKED (the only one)', () => {
    expect(laundry({ installed: true, shortestScreenSide: PHONE })).toBe(true)
    expect(laundry({ installed: true, shortestScreenSide: SMALL_PHONE })).toBe(true)
  })

  it('5. Laundry · installed PWA · tablet → ALLOWED', () => {
    expect(laundry({ installed: true, shortestScreenSide: TABLET })).toBe(false)
    expect(laundry({ installed: true, shortestScreenSide: ANDROID_TABLET })).toBe(false)
  })

  it('6. Laundry · installed PWA · desktop → ALLOWED', () => {
    expect(laundry({ installed: true, shortestScreenSide: DESKTOP })).toBe(false)
  })

  it('7–10. Commerce and Quantix Admin → ALLOWED on every device', () => {
    // Not the Laundry host: the guard cannot fire, installed or not, at any size.
    for (const installed of [true, false]) {
      for (const side of [SMALL_PHONE, PHONE, TABLET, DESKTOP]) {
        expect(shouldRestrictToDesktopTablet({ installed, shortestScreenSide: side, isLaundryOsHost: false })).toBe(false)
      }
    }
  })
})

// ── The things that must never block on their own ─────────────────────────
describe('none of these blocks by itself', () => {
  it('12. a narrow viewport', () => {
    expect(laundry({ shortestScreenSide: 320 })).toBe(false)
  })

  it('13/14. an Android or iPhone user agent — the UA is not consulted at all', () => {
    // The comment names devices as examples; the CODE must never read a UA.
    const code = read('src/lib/device-class.ts').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    for (const ua of ['userAgent', 'Android', 'iPhone', 'iPad', 'Mobile', 'platform']) {
      expect(code, ua).not.toContain(ua)
    }
  })

  it('15. display-mode standalone on Commerce', () => {
    expect(shouldRestrictToDesktopTablet({ installed: true, shortestScreenSide: PHONE, isLaundryOsHost: false })).toBe(false)
  })

  it('16. standalone on Laundry + phone does block — the intended case', () => {
    expect(laundry({ installed: true, shortestScreenSide: PHONE })).toBe(true)
  })

  it('an unreadable screen size fails OPEN', () => {
    // If the measurement is missing, render the workspace rather than a wall.
    expect(laundry({ installed: true, shortestScreenSide: 0 })).toBe(false)
    expect(laundry({ installed: true, shortestScreenSide: NaN })).toBe(false)
  })
})

// ── Orientation ───────────────────────────────────────────────────────────
describe('a tablet is a tablet whichever way up it is', () => {
  it('the SHORT side decides, so rotating changes nothing', () => {
    // 820 × 1180 held either way still yields 820.
    expect(laundry({ installed: true, shortestScreenSide: Math.min(820, 1180) })).toBe(false)
    expect(laundry({ installed: true, shortestScreenSide: Math.min(1180, 820) })).toBe(false)
    // A phone in landscape is 844 wide but still 390 on its short side.
    expect(laundry({ installed: true, shortestScreenSide: Math.min(844, 390) })).toBe(true)
  })

  it('the boundary sits between phones and small tablets', () => {
    expect(laundry({ installed: true, shortestScreenSide: 599 })).toBe(true)
    expect(laundry({ installed: true, shortestScreenSide: 600 })).toBe(false)
  })

  it('it measures the screen, not a resized window', () => {
    expect(read('src/lib/device-class.ts')).toContain('window.screen?.width')
    expect(read('src/lib/device-class.ts')).toContain('Math.min(w, h)')
  })
})

// ── Isolation ─────────────────────────────────────────────────────────────
describe('the guard is Laundry OS only', () => {
  const walk = (d: string): string[] =>
    readdirSync(join(ROOT, d)).flatMap((n) => {
      const p = `${d}/${n}`
      return statSync(join(ROOT, p)).isDirectory() ? walk(p) : /\.tsx?$/.test(n) ? [p] : []
    })

  it('11. exactly one component imports it — the Laundry layout', () => {
    const importers = walk('src/components').concat(walk('src/app'))
      .filter((f) => !f.includes('laundry-device-guard'))
      .filter((f) => read(f).includes('LaundryDeviceGuard'))
    expect(importers).toEqual(['src/components/laundry/layout/laundry-layout.tsx'])
  })

  it('Commerce, Quantix Admin and the phone PWAs never see it', () => {
    for (const f of [
      'src/components/business/apps/apps-view.tsx',
      'src/components/business/stores/stores-view.tsx',
      'src/components/commerce/store/commerce-store-app.tsx',
      'src/components/dashboard/commerce-apps-hub.tsx',
      'src/components/laundry/executive/executive-app.tsx',
      'src/app/laundry/store/page.tsx',
      'src/app/store/page.tsx',
      'src/app/page.tsx',
    ]) {
      expect(read(f), f).not.toContain('LaundryDeviceGuard')
      expect(read(f), f).not.toContain('device-class')
    }
  })

  it('the guard requires the host itself, not just where it is mounted', () => {
    const g = read('src/components/laundry/laundry-device-guard.tsx')
    expect(g).toContain('isLaundryOsHost:')
    expect(g).toContain('shouldRestrictToDesktopTablet({')
    // The old width-only rule is gone.
    expect(g).not.toContain('MIN_OPERATIONAL_WIDTH')
    expect(g).not.toContain('max-width:')
  })

  it('it defaults to allowed until it has measured', () => {
    expect(read('src/components/laundry/laundry-device-guard.tsx')).toContain('if (restricted !== true) return <>{children}</>')
  })

  it('it decides nothing about access', () => {
    const code = read('src/components/laundry/laundry-device-guard.tsx').replace(/\/\/.*$/gm, '')
    for (const forbidden of ['fetch(', 'permission', 'businessId', 'useAuthStore', 'role']) {
      expect(code, forbidden).not.toContain(forbidden)
    }
    const lib = read('src/lib/device-class.ts')
    for (const forbidden of ['fetch(', 'prisma', 'businessId', 'token']) {
      expect(lib, forbidden).not.toContain(forbidden)
    }
  })
})
