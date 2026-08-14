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
    expect(MANIFEST).toContain('${name} Admin App')
    expect(MANIFEST).toContain('${name} Delivery App')
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

  it('a phone width gets a message, not a collapsed console', () => {
    expect(GUARD).toContain('Laundry OS is designed for Desktop &amp; Tablet')
    expect(GUARD).toContain('Please open Laundry OS on a desktop, laptop or tablet')
    expect(GUARD).toContain('MIN_OPERATIONAL_WIDTH = 768')
  })

  it('tablet portrait and everything wider render the console unchanged', () => {
    // 768 is tablet portrait; the guard fires strictly BELOW it.
    expect(GUARD).toContain('max-width: ${MIN_OPERATIONAL_WIDTH - 1}px')
    expect(GUARD).toContain('if (tooNarrow !== true) return <>{children}</>')
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
