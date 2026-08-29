import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
/**
 * Source with ALL comments stripped — block, JSX and line — so prose ABOUT the
 * old bug can never be mistaken for the bug itself.
 */
const code = (p: string) =>
  read(p)
    // Block first — this also empties {/* jsx */} comments, leaving harmless
    // braces. A jsx-specific rule was tried and over-matched: in a .ts file
    // `interface X {` + a JSDoc block + a later `*/}` swallowed the whole body.
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\s+\/\/.*$/gm, '')

const BTN = 'src/components/storefront/install-app-button.tsx'
const BANNER = 'src/components/storefront/web/pwa-install-banner.tsx'
const HOOK = 'src/hooks/use-pwa-install.ts'

describe('ACCEPTANCE · no customer path offers a shortcut instead of an install', () => {
  it.each([BTN, BANNER, 'src/components/storefront/web/storefront-profile.tsx'])(
    '%s never tells the customer to use the browser menu',
    (f) => {
      const src = code(f)
      expect(src.toLowerCase()).not.toContain('create shortcut')
      // "browser menu" + "Add to Home Screen" together is the shortcut instruction
      expect(src).not.toMatch(/browser menu[\s\S]{0,120}Add to Home Screen/i)
      expect(src).not.toMatch(/⋮[\s\S]{0,120}Add to Home Screen/i)
    },
  )

  it('the Android banner button says Install App, not Add to Home Screen', () => {
    expect(code(BANNER)).toContain('{installing ? "Installing…" : "Install App"}')
  })

  it('Add to Home Screen survives ONLY on the iOS branch, where it IS the install', () => {
    const src = code(BTN)
    const ios = src.slice(src.indexOf('{isIos ? ('), src.indexOf(') : ('))
    expect(ios).toContain('Add to Home Screen')
    const android = src.slice(src.indexOf(') : ('))
    expect(android).not.toContain('Add to Home Screen')
  })
})

describe('one install system, not two', () => {
  it('the button reuses the shared hook instead of its own capture', () => {
    const src = code(BTN)
    expect(src).toContain('usePwaInstall')
    expect(src).not.toContain('beforeinstallprompt')
    expect(src).not.toContain('window.__bip')
  })

  it.each([BTN, BANNER, 'src/components/storefront/web/storefront-profile.tsx'])('%s uses usePwaInstall', (f) => {
    expect(code(f)).toContain('usePwaInstall')
  })
})

describe('Android / Chromium', () => {
  it('the button calls the native prompt', () => {
    expect(code(BTN)).toContain('const accepted = await install()')
    expect(code(HOOK)).toContain('await p.prompt()')
    expect(code(HOOK)).toContain('const { outcome } = await p.userChoice')
  })

  it('accept vs dismiss is handled, not ignored', () => {
    expect(code(HOOK)).toContain('return outcome === "accepted"')
    // dismissal shows the explanation; it does not silently do nothing
    expect(code(BTN)).toContain('if (!accepted) setShowModal(true)')
  })

  it('the prompt is cleared once consumed — it can only be used once', () => {
    // Cleared in the SHARED store, so every consumer on the page sees it go.
    expect(code(HOOK)).toContain('sharedPrompt = null')
  })

  it('a dismissed prompt leaves the button usable, never a shortcut', () => {
    const src = code(BTN)
    // still rendered (no early return for "no prompt" on a Chromium browser)
    expect(src).toContain('if (mode === "pwa" && !browserSupported && !canInstall) return null')
    expect(src).toContain('reload the page and tap')
  })

  it('appinstalled flips the state', () => {
    const h = code(HOOK)
    expect(h).toContain('window.addEventListener("appinstalled"')
    expect(h).toContain('setIsInstalled(true)')
  })
})

describe('iOS', () => {
  it('never attempts a prompt — the Share sheet is the install path', () => {
    expect(code(BTN)).toContain('if (isIos) { setShowModal(true); return }')
  })

  it('shows the three Safari steps, in the app, without navigating away', () => {
    const src = read(BTN)
    expect(src).toContain('Share</strong> button in Safari')
    expect(src).toContain('Add to Home Screen</strong>')
    expect(src).toContain('Tap <strong>Add</strong>')
    expect(code(BTN)).not.toContain('window.location')
  })

  it('iPad and iPhone are both detected, including standalone', () => {
    const h = code(HOOK)
    expect(h).toContain('/iphone|ipad|ipod/i.test(navigator.userAgent)')
    expect(h).toContain('(navigator as { standalone?: boolean }).standalone === true')
  })
})

describe('installed and unsupported states', () => {
  it('an installed app shows "App Installed", never an install action', () => {
    const src = code(BTN)
    expect(src).toContain('if (mode === "pwa" && isInstalled)')
    expect(src).toContain('App Installed')
  })

  it('standalone detection drives it', () => {
    expect(code(HOOK)).toContain('window.matchMedia("(display-mode: standalone)").matches')
  })

  it('a browser that cannot install hides the action rather than breaking', () => {
    expect(code(BTN)).toContain('return null')
  })
})

describe('nothing else was touched', () => {
  it('the button holds no order, payment or workflow logic', () => {
    const src = code(BTN)
    // Word boundaries: "borderColor" is not an order, and "package" is not a bag.
    for (const w of ['order', 'payment', 'garment', 'bag', 'prisma']) {
      expect(src, `install button must not reference ${w}`).not.toMatch(new RegExp(`\\b${w}\\b`, 'i'))
    }
    expect(src).not.toContain('fetch(')
  })

  it('the manifest and service worker were not modified by this fix', () => {
    // Installability infrastructure is reused as-is: a fetch handler and
    // 192/512 icons already exist, which is what makes a real install possible.
    expect(read('src/app/sw.js/route.ts')).toContain("addEventListener('fetch'")
    expect(read('src/app/manifest.json/route.ts')).toContain("sizes: '512x512'")
  })
})

// ============================================================================
// The regression the customer actually hit on vastrasudha.co.in: several
// consumers on one page, one single-use event.
// ============================================================================
describe('one shared prompt, however many consumers are on the page', () => {
  const H = code(HOOK)

  it('the storefront home really does mount several consumers at once', () => {
    // banner (twice) + the header button — all usePwaInstall
    const home = read('src/components/storefront/web/storefront-home.tsx')
    expect((home.match(/<PwaInstallBanner/g) ?? []).length).toBeGreaterThanOrEqual(2)
    expect(code('src/components/storefront/web/storefront-layout.tsx')).toContain('<InstallAppButton')
    expect(code(BANNER)).toContain('usePwaInstall')
    expect(code(BTN)).toContain('usePwaInstall')
  })

  it('the event lives in module scope, not per component', () => {
    expect(H).toContain('let sharedPrompt: BeforeInstallPromptEvent | null = null')
    expect(H).toContain('const subscribers = new Set<() => void>()')
  })

  it('no instance claims window.__bip for itself any more', () => {
    // Exactly one claim, inside the once-per-page wiring — not in the hook body.
    expect((H.match(/window\.__bip = null/g) ?? []).length).toBe(1)
    expect(H).toContain('function wireOnce()')
    expect(H).toContain('if (wired || typeof window === "undefined") return')
  })

  it('listeners are attached once per page, not once per component', () => {
    const effect = H.slice(H.indexOf('useEffect(() => {'))
    expect(effect).not.toContain('window.addEventListener("beforeinstallprompt"')
    expect(effect).toContain('wireOnce()')
    expect(effect).toContain('subscribers.add(sync)')
  })

  it('consuming the prompt clears it for everyone, and notifies them', () => {
    const inst = H.slice(H.indexOf('const install = useCallback'), H.indexOf('const dismiss = useCallback'))
    expect(inst).toContain('sharedPrompt = null')
    expect(inst).toContain('notify()')
  })

  it('appinstalled clears the shared prompt and flips every consumer', () => {
    expect(H).toContain('sharedInstalled = true')
    expect(H).toContain('sharedPrompt = null')
  })

  it('the Android modal explains the already-installed case', () => {
    expect(read(BTN)).toContain('Already installed it?')
  })
})

// ============================================================================
// THE root cause on vastrasudha.co.in. Chrome only honours a manifest link in
// <head>; Next's streamed `metadata.manifest` emitted it into <body>, so Chrome
// never requested the manifest at all:
//   Page.getInstallabilityErrors → [{ errorId: "no-manifest" }]
// and beforeinstallprompt therefore never fired.
// ============================================================================
describe('the manifest link is a real <head> child', () => {
  // Comment-stripped: the explanation above the link mentions <head> and the
  // link itself, and must not be mistaken for either.
  const LAYOUT = code('src/app/layout.tsx')

  it('is rendered inside the literal <head> element', () => {
    const head = LAYOUT.slice(LAYOUT.indexOf('<head>'), LAYOUT.indexOf('</head>'))
    expect(head).toContain('<link rel="manifest" href="/manifest.json" />')
  })

  it('is NOT declared through streamed metadata, which lands in <body>', () => {
    const meta = LAYOUT.slice(LAYOUT.indexOf('export const metadata'), LAYOUT.indexOf('export default'))
    expect(meta).not.toMatch(/^\s*manifest:/m)
  })

  it('there is exactly one manifest declaration, so none can win over the other', () => {
    expect((LAYOUT.match(/rel="manifest"/g) ?? []).length).toBe(1)
  })

  it('the head link precedes the body in source order', () => {
    expect(LAYOUT.indexOf('rel="manifest"')).toBeLessThan(LAYOUT.indexOf('<body'))
  })
})
