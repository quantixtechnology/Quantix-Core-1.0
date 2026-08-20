import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// ============================================================================
// The PWAs must be installable applications, not home-screen bookmarks.
//
// THE BUG THIS FIXES: CacheBuster fetched /api/debug/runtime-version and
// returned early when the response was not ok — before registering the service
// worker. That route is platform-admin gated, so it answers 401 for every
// ordinary visitor, including every delivery executive and store user. The
// service worker was therefore never registered in production: /sw.js was
// served, valid, and nobody ever ran it.
//
// Registering the worker is core app capability. It cannot depend on a
// diagnostics endpoint answering.
// ============================================================================

const ROOT = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

const BUSTER = read('src/components/cache-buster.tsx')
const MANIFEST = read('src/app/manifest.json/route.ts')
const ROOT_LAYOUT = read('src/app/layout.tsx')

describe('the service worker always registers', () => {
  it('registration does not sit behind the version check', () => {
    // The early return that skipped it is gone.
    expect(BUSTER).not.toContain('if (!res.ok) return')
    const run = BUSTER.slice(BUSTER.indexOf('export function CacheBuster'))
    const buildIdx = run.indexOf('await fetchBuildId()')
    const regIdx = run.indexOf('await registerSW(')
    expect(buildIdx).toBeGreaterThan(-1)
    expect(regIdx).toBeGreaterThan(buildIdx)
    // Nothing between them may return out of the function unconditionally.
    expect(run.slice(buildIdx, regIdx)).not.toMatch(/\n\s*return\s*$/)
  })

  it('an unknown build id still registers the worker', () => {
    expect(BUSTER).toContain('await registerSW(serverBuild ?? "unknown")')
  })

  it('there is a public fallback for the build id', () => {
    // The debug route is gated; build-info is public and changes per deploy.
    expect(BUSTER).toContain('const PUBLIC_VERSION_URL = "/api/build-info"')
    expect(BUSTER).toContain('json?.buildTime')
  })

  it('cache-busting only fires when a build id is actually known', () => {
    // Without this guard a null build id would look like a version change and
    // reload the app in a loop.
    expect(BUSTER).toContain('if (serverBuild && localBuild && localBuild !== serverBuild)')
    expect(BUSTER).toContain('if (serverBuild && !localBuild)')
  })

  it('it registers at the root scope, covering start_url', () => {
    expect(BUSTER).toContain('navigator.serviceWorker.register("/sw.js", { scope: "/" })')
  })

  it('the registrar is mounted for every route, including the PWA hosts', () => {
    expect(ROOT_LAYOUT).toContain('<CacheBuster />')
  })
})

describe('the manifest meets Chrome install criteria', () => {
  const block = (from: string, to: string) =>
    MANIFEST.slice(MANIFEST.indexOf(from), MANIFEST.indexOf(to))
  const store = block('    : isStore', '    : isExecutive')
  const exec = block('    : isExecutive', '    : isDelivery')

  for (const [label, b] of [['Delivery', exec], ['Admin', store]] as const) {
    describe(`${label} PWA`, () => {
      it('declares a standalone display', () => {
        expect(b).toContain("display:          'standalone'")
      })

      it('declares both required icon sizes as PNG', () => {
        expect(b).toContain("sizes: '192x192', type: 'image/png'")
        expect(b).toContain("sizes: '512x512', type: 'image/png'")
      })

      it('offers a maskable icon for the Android launcher', () => {
        expect(b).toContain("purpose: 'maskable'")
      })

      it('does not defer to a native app', () => {
        expect(b).toContain('prefer_related_applications: false')
      })

      it('has a start_url inside its own scope', () => {
        expect(b).toMatch(/start_url:\s+\w+Start/)
        expect(b).toMatch(/scope:\s+\w+Scope/)
      })

      it('has an id, so the install is a distinct app', () => {
        expect(b).toContain('id:               ')
      })
    })
  }

  it('a dedicated host puts the app at the root', () => {
    // delivery.<tenant> and store.<tenant> ARE the app — scope '/' means the
    // installed window never falls out of scope into a browser tab.
    expect(MANIFEST).toContain("const execScope = isDeliveryHost ? '/' : '/laundry/executive'")
    expect(MANIFEST).toContain("const storeScope = isStoreHost ? '/' : '/laundry/store'")
  })
})
