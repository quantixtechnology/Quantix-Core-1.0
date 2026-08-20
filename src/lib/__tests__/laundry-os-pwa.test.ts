import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { resolveWorkspaceTenant } from '@/lib/workspace-tenant'

// ============================================================================
// One installed Laundry OS, for every business its operator is authorized for.
//
// The workspace host carried the tenant — laundry.<base>/<businessId> — and the
// client read that first path segment straight into the active business with no
// membership check. Nothing leaked: every /api/laundry route resolves the caller
// against the business it is handed, and getLaundryAuthContext requires an
// active BusinessUser row, so another tenant's data came back 401 and the
// workspace gate refused entry. But a URL that LOOKS like it selects a tenant is
// the wrong shape to build a shared, installable app on.
//
// So the URL became a hint the session may refuse, and the app it installs names
// the product rather than a business.
// ============================================================================

const ROOT = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

const A = 'biz-a'
const B = 'biz-b'
const tenantOf = (i: Partial<Parameters<typeof resolveWorkspaceTenant>[0]>) =>
  resolveWorkspaceTenant({
    urlBusinessId: null, memberBusinessIds: [], currentBusinessId: null, isPlatformRole: false, ...i,
  })

// ── The URL is a hint, not authority ──────────────────────────────────────
describe('a URL never selects a business the session cannot enter', () => {
  it('Business A user opening Business A → allowed', () => {
    const t = tenantOf({ urlBusinessId: A, memberBusinessIds: [A], currentBusinessId: A })
    expect(t.businessId).toBe(A)
    expect(t.source).toBe('url')
    expect(t.refusedUrlBusinessId).toBe(false)
  })

  it('Business A user opening Business B → B is NOT selected', () => {
    const t = tenantOf({ urlBusinessId: B, memberBusinessIds: [A], currentBusinessId: A })
    expect(t.businessId).toBe(A)
    expect(t.businessId).not.toBe(B)
    expect(t.source).toBe('session')
    expect(t.refusedUrlBusinessId).toBe(true)
  })

  it('…and B is not attempted first and recovered from', () => {
    // The resolver returns A. Nothing downstream is ever handed B, so no
    // request for B's data is made at all.
    const t = tenantOf({ urlBusinessId: B, memberBusinessIds: [A], currentBusinessId: A })
    expect(t.businessId).toBe(A)
  })

  it('a stale localStorage business is no better than a URL', () => {
    // currentBusinessId comes from localStorage. It is used only as the
    // FALLBACK when the URL is refused — and it is the same session value the
    // server already re-checks on every request.
    const t = tenantOf({ urlBusinessId: B, memberBusinessIds: [A], currentBusinessId: B })
    expect(t.businessId).toBe(B)
    // …which the server then refuses, exactly as it does today: the client
    // cannot grant itself anything by editing storage.
    expect(read('src/lib/laundry-auth.ts')).toContain('prisma.businessUser.findFirst')
    expect(read('src/lib/laundry-rbac.ts')).toContain('getLaundryAuthContext(biz.id, request)')
  })

  it('a user of several businesses may open any of THEIRS', () => {
    for (const id of [A, B]) {
      expect(tenantOf({ urlBusinessId: id, memberBusinessIds: [A, B], currentBusinessId: A }).businessId).toBe(id)
    }
    expect(tenantOf({ urlBusinessId: 'biz-c', memberBusinessIds: [A, B], currentBusinessId: A }).businessId).toBe(A)
  })

  it('platform staff keep their existing unrestricted access', () => {
    // Super Admin holds no BusinessUser rows and opens any tenant through
    // "Open Workspace"; the server grants support mode. Narrowing them here
    // would break that, so the rule is preserved.
    const t = tenantOf({ urlBusinessId: B, memberBusinessIds: [], currentBusinessId: null, isPlatformRole: true })
    expect(t.businessId).toBe(B)
    expect(t.source).toBe('platform')
  })

  it('no URL at all → the session decides', () => {
    expect(tenantOf({ memberBusinessIds: [A], currentBusinessId: A }).source).toBe('session')
    expect(tenantOf({ memberBusinessIds: [A] }).source).toBe('membership')
  })

  it('a session with no business gets none — never an invented one', () => {
    const t = tenantOf({ urlBusinessId: B })
    expect(t.businessId).toBeNull()
    expect(t.source).toBe('none')
    expect(t.refusedUrlBusinessId).toBe(true)
  })

  it('the resolver only picks between ids the session already holds', () => {
    const src = read('src/lib/workspace-tenant.ts')
    for (const forbidden of ['fetch(', 'prisma', 'localStorage', 'window.', 'permission']) {
      expect(src, forbidden).not.toContain(forbidden)
    }
  })

  it('the workspace uses it instead of the raw URL segment', () => {
    const page = read('src/app/page.tsx')
    expect(page).toContain('resolveWorkspaceTenant({')
    expect(page).toContain('memberBusinessIds: businesses.map((b) => b.businessId)')
    // The two old expressions that trusted the URL are gone.
    expect(page).not.toContain('(productWorkspaceCode ? (workspaceBusinessId || currentBusinessId) : currentBusinessId)')
    expect(page).not.toContain('const bizId = workspaceBusinessId || currentBusinessId')
  })
})

// ── The server is still the authority ─────────────────────────────────────
describe('nothing about server-side authorization changed', () => {
  it('tenant membership is still proven per request', () => {
    const auth = read('src/lib/laundry-auth.ts')
    expect(auth).toContain('prisma.businessUser.findFirst')
    expect(auth).toContain('isSupportMode: true')
  })

  it('the RBAC guards are untouched', () => {
    const rbac = read('src/lib/laundry-rbac.ts')
    expect(rbac).toContain('export async function requireLaundryLevel')
    expect(rbac).toContain('export async function requireLaundryMember')
    expect(rbac).toContain('export async function requireLaundryAnyLevel')
  })

  it('the PWA host boundary still fails closed', () => {
    expect(read('src/lib/pwa-tenant-boundary.ts')).toContain('if (host.kind === "unknown-tenant") return false')
  })
})

// ── The installed app ─────────────────────────────────────────────────────
describe('one Laundry OS, installed once', () => {
  const MANIFEST = read('src/app/manifest.json/route.ts')

  it('the workspace host has its own manifest instead of the storefront default', () => {
    expect(MANIFEST).toContain("getProductCodeForHost(rawHost, SF_BASE) === 'LAUNDRY'")
    expect(MANIFEST).toContain("name:             'Laundry OS'")
    expect(MANIFEST).toContain("short_name:       'Laundry OS'")
    expect(MANIFEST).toContain("display:          'standalone'")
  })

  it('it is not pinned to a phone orientation', () => {
    const os = MANIFEST.slice(MANIFEST.indexOf("name:             'Laundry OS'"))
    expect(os.slice(0, 900)).toContain("orientation:      'any'")
  })

  it('the manifest names the PRODUCT, never a tenant', () => {
    // One installation serving every business the operator is authorized for
    // is only possible if the app has no tenant baked into it.
    const os = MANIFEST.slice(MANIFEST.indexOf("name:             'Laundry OS'"), MANIFEST.indexOf('    : isStore'))
    expect(os).not.toContain('${name}')
    expect(os).not.toContain('slug')
    expect(os).toContain("start_url:        '/?source=pwa'")
  })

  it('the other three PWAs keep their own manifests', () => {
    // The tenant apps are now labelled role-first — see the naming block below.
    expect(MANIFEST).toContain("appLabel('store')")
    expect(MANIFEST).toContain("appLabel('delivery')")
    expect(MANIFEST).toContain('isStoreHost')
    expect(MANIFEST).toContain('isDeliveryHost')
  })

  it('Super Admin can hand out Laundry OS per business, from one URL', () => {
    const hub = read('src/components/dashboard/commerce-apps-hub.tsx')
    expect(hub).toContain('title="Laundry OS"')
    expect(hub).toContain('Unified Laundry Operations App')
    expect(hub).toContain('laundryOs: `https://laundry.${SF_BASE}`')
    // The business is named on the card; it is not in the URL.
    expect(hub).toContain('Access for ${selected.name}')
    expect(hub).not.toContain('laundry.${slug}')
  })
})

// ── Desktop and tablet ────────────────────────────────────────────────────
describe('Laundry OS is a desktop and tablet console', () => {
  const GUARD = read('src/components/laundry/laundry-device-guard.tsx')

  it('the INSTALLED app on a phone gets a message, not a collapsed console', () => {
    expect(GUARD).toContain('Laundry OS is designed for Desktop &amp; Tablet')
    expect(GUARD).toContain('Please open Laundry OS on a desktop, laptop or tablet')
  })

  it('a normal mobile BROWSER is never blocked — see laundry-device-guard.test.ts', () => {
    // Superseded: the guard used viewport width alone, which blocked anyone
    // opening the workspace in Chrome on a phone. It now needs the Laundry
    // host AND standalone AND a phone-sized screen.
    expect(GUARD).toContain('shouldRestrictToDesktopTablet({')
    expect(GUARD).toContain('installed: isStandaloneDisplay()')
    expect(GUARD).not.toContain('MIN_OPERATIONAL_WIDTH')
    expect(GUARD).toContain('if (restricted !== true) return <>{children}</>')
  })

  it('it is presentation only — it decides nothing about access', () => {
    // Prose explains that; the CODE must not touch any of it.
    const code = GUARD.replace(/\/\/.*$/gm, '')
    for (const forbidden of ['fetch(', 'permission', 'businessId', 'useAuthStore', 'role']) {
      expect(code, forbidden).not.toContain(forbidden)
    }
  })

  it('it sits inside the authorization gate, and covers only Laundry OS', () => {
    const layout = read('src/components/laundry/layout/laundry-layout.tsx')
    expect(layout.indexOf('LaundryWorkspaceGate>')).toBeLessThan(layout.indexOf('<LaundryDeviceGuard>'))
    // The phone apps are untouched.
    for (const f of ['src/components/laundry/executive/executive-app.tsx', 'src/app/laundry/store/page.tsx']) {
      expect(read(f)).not.toContain('LaundryDeviceGuard')
    }
  })
})

// ── Scope ─────────────────────────────────────────────────────────────────
describe('nothing else moved', () => {
  it('the Store PWA still runs during the transition', () => {
    expect(read('src/app/store/page.tsx')).toContain('LaundryStoreApp')
    expect(read('src/proxy.ts')).toContain("hostWithoutPort.startsWith('store.')")
  })

  it('the Delivery Executive PWA is untouched', () => {
    expect(read('src/proxy.ts')).toContain("hostWithoutPort.startsWith('delivery.')")
    expect(read('src/lib/laundry-executive-auth.ts')).toContain('resolveExecutive(request: Request)')
  })

  it('the scanner and printer layers are untouched', () => {
    const engine = read('src/lib/hardware/scan-engine.ts')
    expect(engine).toContain('e.key === "Enter" || e.key === "Tab"')
    expect(engine).toContain('data-scan-sink')
    expect(engine).toContain('diagnostics.recordScan(code, resolved, durationMs)')
    expect(read('src/lib/hardware/use-scan-sink.ts')).toContain('ScanEngine.submit(')
  })

  it('no new tenant, RBAC, permission or auth model was introduced', () => {
    const schema = read('prisma/schema.prisma')
    for (const m of ['model WorkspaceTenant', 'model LaundryOsSession', 'model AppInstall']) {
      expect(schema).not.toContain(m)
    }
    // It reads a boolean the session already computed; it never resolves a role.
    const wt = read('src/lib/workspace-tenant.ts')
    expect(wt).not.toContain('PLATFORM_ROLES')
    expect(wt).not.toContain('resolveUserPermissions')
  })
})

// ── The card has to be on the page the operator actually opens ────────────
//
// It was not. The card went into commerce-apps-hub.tsx — the PLATFORM Mobile
// Apps screen, with its own tenant picker and its own card names ("Customer
// Website & PWA", "Store Admin PWA", "Delivery Executive PWA"). The screen a
// business owner opens from the Laundry sidebar is a different component
// entirely, laundry-mobile-apps.tsx, whose cards read "Customer App",
// "Executive Pickup & Delivery App", "Store Admin App" and "Delivery Tracking
// Links" — exactly what production showed. Unit tests passed the whole time
// because they asserted against the file the card was in.
describe('the Mobile Apps page a business owner opens', () => {
  const TENANT_HUB = read('src/components/laundry/views/laundry-mobile-apps.tsx')
  const PLATFORM_HUB = read('src/components/dashboard/commerce-apps-hub.tsx')

  it('is laundry-mobile-apps, identified by the cards production showed', () => {
    for (const card of ['Customer App', 'Executive Pickup & Delivery App', 'Store Admin App', 'Delivery Tracking Links']) {
      expect(TENANT_HUB, card).toContain(card)
    }
    // …and it is NOT the platform hub, whose cards are named differently.
    expect(PLATFORM_HUB).toContain('Customer Website & PWA')
    expect(TENANT_HUB).not.toContain('Customer Website & PWA')
  })

  it('now carries the Laundry OS card', () => {
    expect(TENANT_HUB).toContain('title="Laundry OS"')
    expect(TENANT_HUB).toContain('Unified Laundry Operations App — store, processing and administration in one place.')
  })

  it('the card names the business without putting it in the URL', () => {
    expect(TENANT_HUB).toContain('Access for ${businessName || "your business"}')
    expect(TENANT_HUB).toContain('const laundryOsUrl = `https://laundry.${SF_BASE}`')
    // No tenant-specific Laundry OS host, ever.
    expect(TENANT_HUB).not.toContain('laundry.${slug}')
    expect(TENANT_HUB).not.toContain('laundry.${businessName}')
  })

  it('it offers the same share actions as every other card', () => {
    // Copy, QR (print dialog) and WhatsApp all come from AppShareCard; the
    // Open action is its external-link control.
    const card = read('src/components/laundry/apps/app-share-card.tsx')
    expect(card).toContain('CopyButton')
    expect(card).toContain('wa.me')
    expect(card).toContain('QrCode')
    expect(card).toContain('<a href={url} target="_blank"')
    expect(TENANT_HUB).toContain('qrDialog={{ businessName: businessName || "Your Business", appName: "Laundry OS" }}')
  })

  it('the other three apps and the tracking panel are untouched', () => {
    expect(TENANT_HUB).toContain('url={customerUrl}')
    expect(TENANT_HUB).toContain('url={executiveUrl}')
    expect(TENANT_HUB).toContain('url={storeAdminUrl}')
    expect(TENANT_HUB).toContain('Delivery Tracking Links')
    // Their per-tenant provisioning strips still render.
    expect(TENANT_HUB.match(/<StatusStrip/g)).toHaveLength(3)
  })

  it('Laundry OS has no provisioning strip, because it has no tenant host', () => {
    expect(TENANT_HUB).toContain('Shared host — always available, nothing to provision.')
  })
})

// ── Classification, where a screen can serve any tenant ───────────────────
describe('which businesses see a Laundry OS card', () => {
  it('the tenant page is a Laundry-workspace screen, so it cannot render elsewhere', () => {
    // No classification check is needed — or honest — here: this component is
    // registered only under the Laundry screen key and rendered only by the
    // Laundry page router. A Commerce tenant never reaches it.
    expect(read('src/lib/laundry-nav-config.ts')).toContain('"laundry.mobile_apps": "mobile-apps"')
    expect(read('src/components/laundry/laundry-page-router.tsx')).toContain('case "mobile-apps": return <LaundryMobileApps />')
    expect(read('src/components/commerce/store/commerce-store-app.tsx')).not.toContain('LaundryMobileApps')
  })

  it('the PLATFORM hub does serve every tenant, so there it is classified', () => {
    const hub = read('src/components/dashboard/commerce-apps-hub.tsx')
    expect(hub).toContain('selected.productCode === "LAUNDRY"')
    // The existing classification, from the existing business record — no
    // second scheme, no name matching, no hardcoded tenant.
    expect(hub).not.toMatch(/VASTRASUDHA|vastrasudha/i)
    expect(hub).not.toMatch(/name.*includes\(["']aundry/)
    expect(hub).not.toContain('cmqjfpuvj0000')
  })

  it('a missing classification fails safely — no card', () => {
    // `productCode` is optional on the row; undefined !== "LAUNDRY", so the
    // card is hidden rather than shown by default.
    const hub = read('src/components/dashboard/commerce-apps-hub.tsx')
    expect(hub).toContain('productCode?: string | null')
    expect(hub).toContain('selected && selected.productCode === "LAUNDRY" && (')
  })

  it('productCode is really carried on that row', () => {
    // Verified against production: Laundry & Drycleaners → productCode LAUNDRY.
    expect(read('src/app/api/admin/businesses/route.ts')).toContain('productCode: b.productCode')
  })
})

// ── Installing is installing, not access ──────────────────────────────────
//
// A PWA install is the browser wrapping the site it is already on in its own
// window. There is no file, no package, and nothing about the install that the
// server treats as authority. So the button promises neither a binary nor a
// tenant.
describe('the Install action', () => {
  const INSTALL = read('src/components/laundry/apps/pwa-install-button.tsx')
  const TENANT_HUB = read('src/components/laundry/views/laundry-mobile-apps.tsx')

  it('the browser decides installability — the user agent only names the device', () => {
    // Only the browser knows about the manifest, the service worker, HTTPS,
    // whether it is already installed and its own engagement rules.
    expect(INSTALL).toContain("window.addEventListener(\"beforeinstallprompt\", onPrompt)")
    expect(INSTALL).toContain('prompt ? (')
    // The UA is read once, and only to choose a label.
    expect(INSTALL).toContain('function describeDevice(ua: string): Platform')
    expect(INSTALL).toContain('function installLabel(p: Platform)')
    // It must never be what decides whether the button appears.
    expect(INSTALL).not.toMatch(/if \(platform === "(windows|android)"\)\s*\{?\s*return true/)
  })

  it('a real click drives the browser prompt and handles both outcomes', () => {
    expect(INSTALL).toContain('await prompt.prompt()')
    expect(INSTALL).toContain('const { outcome } = await prompt.userChoice')
    expect(INSTALL).toContain('if (outcome === "accepted") setAccepted(true)')
    expect(INSTALL).toContain('else setDismissed(true)')
    // The event is single-use; it is dropped either way.
    expect(INSTALL).toContain('setPrompt(null)')
  })

  it('Windows and Android get the same mechanism, differently named', () => {
    expect(INSTALL).toContain('"Install on Windows PC"')
    expect(INSTALL).toContain('"Install on Android Tablet"')
    expect(INSTALL).toContain('"Install Laundry OS"')
  })

  it('already installed → Installed and Open, never another install prompt', () => {
    expect(INSTALL).toContain('window.matchMedia("(display-mode: standalone)").matches')
    expect(INSTALL).toContain('window.addEventListener("appinstalled", onInstalled)')
    // The browser is asked directly rather than mirrored into state, so the
    // installed window is recognised on first render.
    expect(INSTALL).toContain('useSyncExternalStore(subscribeDisplayMode, readStandalone')
    expect(INSTALL).toContain('Installed')
    expect(INSTALL).toContain('Open {appName}')
  })

  it('no install prompt → instructions, never a button that does nothing', () => {
    expect(INSTALL).toContain('Install manually')
    expect(INSTALL).toContain('Install app / Add to Home screen')
    expect(INSTALL).toContain('choose Install Laundry OS')
  })

  it('nothing is downloaded and nothing is packaged', () => {
    for (const forbidden of ['.exe', '.msi', '.apk', '.aab', 'electron', 'download=', 'createObjectURL']) {
      expect(INSTALL.toLowerCase(), forbidden).not.toContain(forbidden)
    }
  })

  it('installing carries no tenant, and grants nothing', () => {
    for (const forbidden of ['businessId', 'localStorage', 'token', 'fetch(', 'prisma']) {
      expect(INSTALL, forbidden).not.toContain(forbidden)
    }
  })

  it('the card leads with Install and keeps every share action', () => {
    expect(TENANT_HUB).toContain('primaryAction={<PwaInstallButton appName="Laundry OS" url={laundryOsUrl} />}')
    const card = read('src/components/laundry/apps/app-share-card.tsx')
    expect(card).toContain('{primaryAction}')
    // Copy / QR / WhatsApp / Open all still there, for every card.
    expect(card).toContain('Copy Link')
    expect(card).toContain('QR Code')
    expect(card).toContain('WhatsApp')
    // …and the primary slot is opt-in, so the other three cards are unchanged.
    expect(card).toContain('primaryAction?: React.ReactNode')
    expect(TENANT_HUB.match(/primaryAction=/g)).toHaveLength(1)
  })

  it('the QR encodes the shared host — the Windows-to-tablet path', () => {
    // Super Admin on a PC scans it with the tablet, which then installs.
    expect(TENANT_HUB).toContain('url={laundryOsUrl}')
    expect(TENANT_HUB).toContain('const laundryOsUrl = `https://laundry.${SF_BASE}`')
    expect(read('src/components/laundry/apps/app-share-card.tsx')).toContain('QRCode.toDataURL(url')
  })
})
