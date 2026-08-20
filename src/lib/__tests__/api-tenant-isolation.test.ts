import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { execSync } from 'child_process'
import { join } from 'path'

// ============================================================================
// Knowing a Business ID must never be enough to reach that business's data.
//
// A sweep of all 682 API routes found tenant and platform endpoints answering
// unauthenticated — including /api/laundry/businesses, which returns EVERY
// tenant's name, owner email and owner mobile with no id required at all.
//
// This test pins the routes that were closed, and pins that the intentionally
// public ones stayed public. It reads the sources rather than mocking, because
// the property being protected is "a guard is present on this handler".
// ============================================================================

const ROOT = join(__dirname, '../../..')
const src = (p: string) => readFileSync(join(ROOT, 'src/app/api', p, 'route.ts'), 'utf8')

/** Any of the platform's existing guards. No new mechanism was introduced. */
const GUARDS = [
  'requireLaundryMember', 'requireLaundryPermission', 'requireLaundryLevel',
  'platformOnly', 'withPlatformAccess', 'requireAuth: true',
  'requireStoreAdmin', 'resolveExecutive', 'resolveSession',
]
const guarded = (s: string) => GUARDS.some((g) => s.includes(g))

// ── A. Tenant routes — membership required ────────────────────────────────
describe('A. laundry tenant routes require membership', () => {
  const TENANT = [
    'laundry/businesses/[id]', 'laundry/businesses/[id]/features', 'laundry/businesses/[id]/setup',
    'laundry/storage', 'laundry/subscriptions/active', 'laundry/subscriptions/preview',
    'laundry/rbac/catalog', 'laundry/crm/entitlement', 'laundry/assignments',
    'laundry/billing/quote', 'laundry/scan', 'laundry/items/[id]/barcode',
    'laundry/seed-demo', 'laundry/seed-storefront',
  ]
  for (const r of TENANT) {
    it(`${r} is guarded`, () => {
      expect(guarded(src(r))).toBe(true)
    })
  }

  it('the guard is membership, not a bare businessId check', () => {
    // requireLaundryMember resolves the tenant AND requires an active
    // BusinessUser row for it, so Business A cannot read Business B.
    for (const r of ['laundry/storage', 'laundry/businesses/[id]', 'laundry/scan']) {
      expect(src(r)).toContain('requireLaundryMember')
    }
  })

  it('a scanned barcode is not authorization', () => {
    // /api/laundry/scan returned full garment + order detail to anyone with a
    // GAR code, and those are sequential.
    const s = src('laundry/scan')
    expect(s).toContain('requireLaundryMember(request, item.order.businessId)')
  })
})

// ── B. Platform routes — platform staff only ──────────────────────────────
describe('B. platform-wide routes are platform-only', () => {
  const PLATFORM = [
    'laundry/businesses', 'admin/rbac', 'admin/rbac/[role]', 'admin/config/health',
    'admin/laundry/gar-backfill', 'admin/payment-plugins', 'core/seed',
  ]
  for (const r of PLATFORM) {
    it(`${r} is platform-gated`, () => {
      const s = src(r)
      expect(s.includes('platformOnly') || s.includes('withPlatformAccess') || s.includes('QUANTIX_SUPER_ADMIN')).toBe(true)
    })
  }

  it('the cross-tenant business list is not reachable by a tenant', () => {
    // It needed no id at all and returned every business on the platform.
    expect(src('laundry/businesses')).toContain('platformOnly(request)')
  })

  it('every debug route is platform-gated', () => {
    // One of them carried the comment "TEMP: no auth — production debug only".
    const debugDirs = [
      // 'debug/full-cleanup' is deliberately absent: the route was DELETED.
      // A gated destructive endpoint is still a destructive endpoint, and
      // nothing called it. See the "no delete-everything route" test below.
      'debug/store-live', 'debug/force-store-repair',
      'debug/store-global-repair', 'debug/repair-store-inventory', 'debug/storefront',
      'debug/business-assets', 'debug/subdomain-audit',
    ]
    for (const d of debugDirs) expect(src(d)).toContain('platformOnly')
  })

  it('no route exists that deletes every business', () => {
    // POST /api/debug/full-cleanup took {"confirm":"DELETE_ALL_BUSINESSES"} and
    // removed every tenant, their dependants and their upload directories. It
    // was platform-gated, but nothing in the app ever called it, and one
    // mistaken request from the single Super Admin account would have taken the
    // whole platform. The route is gone; this stops it coming back.
    expect(existsSync(join(ROOT, 'src/app/api/debug/full-cleanup'))).toBe(false)
    const all = execSync(
      "grep -rl 'DELETE_ALL_BUSINESSES' src --exclude-dir=__tests__ || true",
      { cwd: ROOT, encoding: 'utf8' },
    ).trim()
    expect(all).toBe('')
  })
})

// ── C. Intentionally public — must NOT have been gated ────────────────────
describe('C. intentionally public routes stayed public', () => {
  const PUBLIC = [
    // Customer/staff authentication — cannot require a session to get one.
    'core/auth/login', 'core/storefront/auth/verify', 'core/storefront/auth/send-otp',
    'laundry/app/auth/send-otp', 'laundry/app/auth/verify',
    'laundry/executive/auth/login', 'laundry/store-admin/auth/login',
    // Public storefront + customer ordering.
    'core/storefront/laundry-home', 'core/storefront/laundry-slots',
    'core/storefront/serviceability', 'core/storefront/nearest-store',
    'core/storefront/laundry-checkout', 'core/storefront/laundry-order',
    // Public business website CMS.
    'v1/website/general', 'v1/website/homepage', 'v1/website/pricing',
  ]
  for (const r of PUBLIC) {
    it(`${r} remains public`, () => {
      const s = src(r)
      expect(s).not.toContain('platformOnly')
      expect(s).not.toContain('requireLaundryMember')
    })
  }
})

// ── D. The guard helper adds no new security model ────────────────────────
describe('D. no new authorization framework', () => {
  it('platformOnly only re-runs the EXISTING middleware', () => {
    const g = readFileSync(join(ROOT, 'src/lib/platform-guard.ts'), 'utf8')
    expect(g).toContain('withPlatformAccess')
    // No hand-rolled role/permission logic.
    expect(g).not.toContain('platformRole ===')
    expect(g).not.toContain('prisma')
    expect(g).not.toContain('findUnique')
  })

  it('no new permission keys or RBAC tables were introduced', () => {
    const schema = readFileSync(join(ROOT, 'prisma/schema.prisma'), 'utf8')
    expect(schema).not.toContain('model ApiPermission')
    expect(schema).not.toContain('model RouteGuard')
    expect(existsSync(join(ROOT, 'src/lib/laundry-rbac.ts'))).toBe(true)
  })
})
