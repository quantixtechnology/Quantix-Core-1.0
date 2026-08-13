import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// ============================================================================
// The host says WHICH tenant you are trying to enter; your account says which
// tenant you are actually authorized for.
//
// PRODUCTION BUG: delivery.ohhmomos.<base> (a Commerce tenant) rendered
// "Laundry & Drycleaners – Sector 2 · Rahul Kumar", a Laundry Delivery
// Executive. Every PWA resolved its session from the bearer token alone —
// token → that person's OWN business — and never compared it with the host.
// ============================================================================

const mocks = vi.hoisted(() => ({
  domainFindFirst: vi.fn(),
  businessFindFirst: vi.fn(),
  refreshFindFirst: vi.fn(),
  execFindFirst: vi.fn(),
  laundryBizFindUnique: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    domainMapping: { findFirst: mocks.domainFindFirst },
    business: { findFirst: mocks.businessFindFirst },
    refreshToken: { findFirst: mocks.refreshFindFirst },
    laundryDeliveryExecutive: { findFirst: mocks.execFindFirst },
    laundryBusiness: { findUnique: mocks.laundryBizFindUnique },
  },
}))

import { resolveHostTenant, sessionMatchesHostTenant, TENANT_MISMATCH_MESSAGE } from '@/lib/pwa-tenant-boundary'
import { resolveExecutive } from '@/lib/laundry-executive-auth'

const ROOT = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

const req = (host: string) =>
  new Request('http://x/api/laundry/executive/me', { headers: { host, authorization: 'Bearer tok' } })

const LAUNDRY_BIZ = 'biz-laundry'
const COMMERCE_BIZ = 'biz-ohhmomos'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.domainFindFirst.mockResolvedValue(null)
  mocks.businessFindFirst.mockResolvedValue(null)
})

const hostResolvesTo = (platformBusinessId: string) =>
  mocks.domainFindFirst.mockResolvedValue({ businessId: platformBusinessId })

// ── Host → tenant ─────────────────────────────────────────────────────────
describe('the host names a tenant', () => {
  it('strips the PWA prefix: delivery.<tenant> resolves the tenant', async () => {
    hostResolvesTo(COMMERCE_BIZ)
    expect(await resolveHostTenant(req('delivery.ohhmomos.quantixtechnology.in')))
      .toEqual({ platformBusinessId: COMMERCE_BIZ })
    // The lookup used the tenant host, not the delivery.* one.
    expect(JSON.stringify(mocks.domainFindFirst.mock.calls[0][0])).toContain('ohhmomos')
  })

  it('store.<tenant> resolves the same way', async () => {
    hostResolvesTo(COMMERCE_BIZ)
    expect(await resolveHostTenant(req('store.ohhmomos.quantixtechnology.in')))
      .toEqual({ platformBusinessId: COMMERCE_BIZ })
  })

  it('falls back to the business slug when no domain mapping exists', async () => {
    mocks.businessFindFirst.mockResolvedValue({ id: COMMERCE_BIZ })
    expect(await resolveHostTenant(req('delivery.ohhmomos.quantixtechnology.in')))
      .toEqual({ platformBusinessId: COMMERCE_BIZ })
  })

  it('platform and product-workspace hosts name NO tenant', async () => {
    for (const h of ['app.quantixtechnology.in', 'admin.quantixtechnology.in',
                     'laundry.quantixtechnology.in', 'commerce.quantixtechnology.in',
                     'quantixtechnology.in', 'localhost:3000']) {
      expect(await resolveHostTenant(req(h))).toBeNull()
    }
  })
})

// ── The rule ──────────────────────────────────────────────────────────────
describe('a session must match the host tenant', () => {
  it('matching tenant → allowed', async () => {
    hostResolvesTo(LAUNDRY_BIZ)
    expect(await sessionMatchesHostTenant(req('delivery.mylaundry.quantixtechnology.in'), LAUNDRY_BIZ)).toBe(true)
  })

  it('different tenant → refused', async () => {
    hostResolvesTo(COMMERCE_BIZ)
    expect(await sessionMatchesHostTenant(req('delivery.ohhmomos.quantixtechnology.in'), LAUNDRY_BIZ)).toBe(false)
  })

  it('a host that names no tenant contradicts nothing', async () => {
    // Keeps localhost, app.<base> and product workspaces working exactly as
    // before — the session's own business governs there.
    expect(await sessionMatchesHostTenant(req('localhost:3000'), LAUNDRY_BIZ)).toBe(true)
  })

  it('a tenant host with no session business → refused', async () => {
    hostResolvesTo(COMMERCE_BIZ)
    expect(await sessionMatchesHostTenant(req('delivery.ohhmomos.quantixtechnology.in'), null)).toBe(false)
  })
})

// ── The exact production failure ──────────────────────────────────────────
describe('the reported failure, through the real executive resolver', () => {
  const asExecutiveOf = (laundryBusinessId: string, platformBusinessId: string) => {
    mocks.refreshFindFirst.mockResolvedValue({ userId: 'u-rahul' })
    mocks.execFindFirst.mockResolvedValue({ id: 'exec-1', businessId: laundryBusinessId, storeId: 'store-1' })
    mocks.laundryBizFindUnique.mockResolvedValue({ platformBusinessId })
  }

  it('Laundry Executive → Commerce delivery URL → BLOCKED', async () => {
    // Rahul Kumar on delivery.ohhmomos.* — the screenshot.
    asExecutiveOf('lb-laundry', LAUNDRY_BIZ)
    hostResolvesTo(COMMERCE_BIZ)
    expect(await resolveExecutive(req('delivery.ohhmomos.quantixtechnology.in'))).toBeNull()
  })

  it('Commerce Executive → Laundry delivery URL → BLOCKED', async () => {
    asExecutiveOf('lb-commerce', COMMERCE_BIZ)
    hostResolvesTo(LAUNDRY_BIZ)
    expect(await resolveExecutive(req('delivery.mylaundry.quantixtechnology.in'))).toBeNull()
  })

  it('Laundry Executive → own Laundry delivery URL → ALLOWED', async () => {
    asExecutiveOf('lb-laundry', LAUNDRY_BIZ)
    hostResolvesTo(LAUNDRY_BIZ)
    const s = await resolveExecutive(req('delivery.mylaundry.quantixtechnology.in'))
    expect(s).toMatchObject({ executiveId: 'exec-1', businessId: 'lb-laundry' })
  })

  it('Commerce Executive → own Commerce delivery URL → ALLOWED', async () => {
    asExecutiveOf('lb-commerce', COMMERCE_BIZ)
    hostResolvesTo(COMMERCE_BIZ)
    expect(await resolveExecutive(req('delivery.ohhmomos.quantixtechnology.in'))).not.toBeNull()
  })

  it('no tenant data is loaded before the check — the resolver returns null', async () => {
    // The session simply does not resolve, so every downstream handler's
    // "if (!session) return 401" fires before any tenant query runs.
    asExecutiveOf('lb-laundry', LAUNDRY_BIZ)
    hostResolvesTo(COMMERCE_BIZ)
    expect(await resolveExecutive(req('delivery.ohhmomos.quantixtechnology.in'))).toBeNull()
  })
})

// ── Server-side, at the shared boundary ───────────────────────────────────
describe('the check is server-side and shared', () => {
  it('all three PWA resolvers take the Request, so the host always travels', () => {
    // Passing a bare token used to be enough — that is how the host got lost.
    expect(read('src/lib/laundry-executive-auth.ts')).toContain('resolveExecutive(request: Request)')
    expect(read('src/lib/laundry-app-auth.ts')).toContain('resolveSession(request: Request)')
    expect(read('src/lib/laundry-store-admin-auth.ts')).toContain('resolveStoreAdmin(request: Request)')
  })

  it('each PWA enforces the boundary in its resolver', () => {
    expect(read('src/lib/laundry-executive-auth.ts')).toContain('sessionMatchesHostTenant(request')
    expect(read('src/lib/laundry-store-admin-auth.ts')).toContain('sessionMatchesHostTenant(request')
    // The customer app scopes the profile lookup BY the host tenant, which both
    // enforces the boundary and picks the right profile for a two-tenant customer.
    expect(read('src/lib/laundry-app-auth.ts')).toContain('resolveHostTenant(request)')
    expect(read('src/lib/laundry-app-auth.ts')).toContain('businessId: hostTenant.platformBusinessId')
  })

  it('no call site can skip it by passing a token', () => {
    const bad = ['resolveExecutive(bearerToken(', 'resolveSession(bearerToken(', 'resolveStoreAdmin(bearerToken(']
    for (const f of ['src/lib/laundry-executive-auth.ts', 'src/lib/laundry-app-auth.ts', 'src/lib/laundry-store-admin-auth.ts']) {
      for (const b of bad) expect(read(f)).not.toContain(b)
    }
  })

  it('comparison is on the PLATFORM business id, so products compare on one axis', () => {
    // A Laundry executive's businessId is a LaundryBusiness id; the host gives a
    // platform Business id. Without the translation the comparison is meaningless.
    expect(read('src/lib/laundry-executive-auth.ts')).toContain('platformBusinessId')
  })

  it('no new table, role or auth system', () => {
    const lib = read('src/lib/pwa-tenant-boundary.ts')
    expect(lib).not.toContain('createAccessToken')
    expect(lib).not.toContain('refreshToken.create')
    expect(read('prisma/schema.prisma')).not.toContain('model TenantBinding')
    expect(TENANT_MISMATCH_MESSAGE).toBe('This account does not belong to this business.')
  })
})
