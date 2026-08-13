import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// ============================================================================
// Business Licensing / Resource Allocation is QUANTIX SUPER ADMIN ONLY.
//
// It decides what a tenant is entitled to — plan, provisioning state and the
// scaling limits behind the Store / User / Storage quotas. It had NO
// authentication of any kind: both verbs were reachable unauthenticated, so
// anyone knowing a business id could read a tenant's commercial terms and raise
// its quotas.
//
// These tests drive the REAL middleware; only the database is mocked.
// ============================================================================

const mocks = vi.hoisted(() => ({
  findRefreshToken: vi.fn(),
  getPermissions: vi.fn(),
  laundryBusinessFindUnique: vi.fn(),
  scalingUpsert: vi.fn(),
  scalingFindUnique: vi.fn(),
  auditCreate: vi.fn(),
}))

vi.mock('@/lib/db', () => ({ db: { refreshToken: { findUnique: mocks.findRefreshToken } } }))
vi.mock('@/lib/db-permissions', () => ({ getDbPermissionsForRole: mocks.getPermissions }))
vi.mock('@/lib/tenant-resolver', () => ({ resolveTenantFromHostname: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    laundryBusiness: { findUnique: mocks.laundryBusinessFindUnique },
    laundryScalingLimit: { upsert: mocks.scalingUpsert, findUnique: mocks.scalingFindUnique },
    laundryAuditLog: { create: mocks.auditCreate },
  },
}))

import { GET, PUT } from '@/app/api/laundry/businesses/[id]/licensing/route'

const ROOT = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')
const LICENSING = read('src/app/api/laundry/businesses/[id]/licensing/route.ts')
const CORE_BUSINESS = read('src/app/api/core/businesses/[businessId]/route.ts')
const REGISTRY = read('src/lib/laundry-rbac-registry.ts')
const CATALOG = read('src/lib/laundry-rbac-catalog.ts')

const platform = (platformRole: string) => ({
  id: `u-${platformRole}`, email: `${platformRole}@x.com`, name: platformRole,
  isActive: true, platformRole, businessUsers: [], salesProfile: null,
})
const tenant = (role: string) => ({
  id: `u-${role}`, email: `${role}@tenant.com`, name: role, isActive: true, platformRole: null,
  businessUsers: [{ role, storeId: null, business: { id: 'biz-1', name: 'T', businessType: 'GROCERY', slug: 't' } }],
  salesProfile: null,
})
const asUser = (user: unknown) =>
  mocks.findRefreshToken.mockResolvedValue({ token: 't', expiresAt: new Date(Date.now() + 3_600_000), user })

const AUTH = { authorization: 'Bearer test-token' }
const ctx = { params: Promise.resolve({ id: 'lb-1' }) }
const getReq = (headers: Record<string, string> = AUTH) =>
  new Request('http://x/api/laundry/businesses/lb-1/licensing', { headers })
const putReq = (headers: Record<string, string> = AUTH) =>
  new Request('http://x/api/laundry/businesses/lb-1/licensing', {
    method: 'PUT', headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ scalingLimit: { storesAllowed: 999 } }),
  })

beforeEach(() => {
  vi.clearAllMocks()
  // Every permission granted, so a rejection can only come from the ROLE gate.
  mocks.getPermissions.mockResolvedValue(['businesses:view', 'businesses:edit', 'businesses:update', 'businesses:create'])
  mocks.laundryBusinessFindUnique.mockResolvedValue({
    id: 'lb-1', subscription: null, provisioning: [], operationalConfig: null,
    workflowQuality: null, scalingLimit: null, brandingConfig: null,
    platformProvisioning: null, auditLogs: [],
  })
  mocks.scalingFindUnique.mockResolvedValue(null)
  mocks.scalingUpsert.mockResolvedValue({})
  mocks.auditCreate.mockResolvedValue({})
})

describe('who may reach Licensing / Resource Allocation', () => {
  it('unauthenticated → rejected', async () => {
    expect((await GET(getReq({}) as never, ctx)).status).toBe(401)
    expect((await PUT(putReq({}) as never, ctx)).status).toBe(401)
    expect(mocks.scalingUpsert).not.toHaveBeenCalled()
  })

  it('Quantix Super Admin → allowed', async () => {
    asUser(platform('QUANTIX_SUPER_ADMIN'))
    expect((await GET(getReq() as never, ctx)).status).toBe(200)
    expect((await PUT(putReq() as never, ctx)).status).toBe(200)
  })

  for (const role of ['CLIENT_OWNER', 'LAUNDRY_OWNER', 'STORE_MANAGER', 'LAUNDRY_STORE_MANAGER', 'STORE_EXECUTIVE', 'PROCESSING_MANAGER']) {
    it(`${role} → rejected`, async () => {
      asUser(tenant(role))
      expect((await GET(getReq() as never, ctx)).status).toBe(403)
      expect((await PUT(putReq() as never, ctx)).status).toBe(403)
      expect(mocks.scalingUpsert).not.toHaveBeenCalled()
    })
  }

  it('a tenant user cannot reach ANOTHER business\'s licensing either', async () => {
    // The role gate refuses before any business is resolved, so a foreign id
    // is refused for the same reason as their own.
    asUser(tenant('CLIENT_OWNER'))
    const foreign = new Request('http://x/api/laundry/businesses/lb-OTHER/licensing', { headers: AUTH })
    expect((await GET(foreign as never, { params: Promise.resolve({ id: 'lb-OTHER' }) })).status).toBe(403)
  })

  it('even other PLATFORM staff are refused — Super Admin only', async () => {
    for (const role of ['PLATFORM_ADMIN', 'QUANTIX_SALES_TEAM', 'SUPPORT_TEAM', 'FINANCE_TEAM']) {
      asUser(platform(role))
      expect((await GET(getReq() as never, ctx)).status).toBe(403)
    }
  })

  it('an expired session is refused', async () => {
    mocks.findRefreshToken.mockResolvedValue({ token: 't', expiresAt: new Date(Date.now() - 1000), user: platform('QUANTIX_SUPER_ADMIN') })
    expect((await PUT(putReq() as never, ctx)).status).toBe(401)
  })
})

describe('the gate is a ROLE, not a grantable permission', () => {
  it('it uses requiredRoles, so no business role can ever be given it', () => {
    expect(LICENSING).toContain("requiredRoles: [\"QUANTIX_SUPER_ADMIN\"]")
    expect(LICENSING).toContain('requireAuth: true')
    // Not a permission key a tenant role could receive.
    expect(LICENSING).not.toContain('requiredPermission')
    expect(LICENSING).not.toContain('requireLaundryPermission')
  })

  it('no licensing/resource-allocation screen exists in the tenant RBAC catalogue', () => {
    // There is nothing for a business role to be granted — the exposure was the
    // missing API guard, not an over-granted permission.
    for (const f of [REGISTRY, CATALOG]) {
      expect(f).not.toContain('resource_allocation')
      expect(f).not.toContain('laundry.licensing')
      expect(f).not.toContain('scaling')
    }
  })
})

describe('the quota override cannot be self-raised', () => {
  it('resourceOverrides is refused for non-platform callers', () => {
    // PUT /api/core/businesses/[businessId] admits CLIENT_OWNER so a business
    // can maintain its own name, branding and contacts — which let an owner
    // raise their own Store/User/Storage quotas by posting the field directly.
    expect(CORE_BUSINESS).toContain("(body as Record<string, unknown>).resourceOverrides !== undefined && !user.isPlatformAdmin")
    expect(CORE_BUSINESS).toContain('PLATFORM_ONLY_FIELD')
    expect(CORE_BUSINESS).toContain('status: 403')
  })

  it('the rest of the business payload is untouched by the check', () => {
    // Only the quota field is gated; ordinary self-service still works.
    expect(CORE_BUSINESS).toContain("requiredRoles: ['CLIENT_OWNER', 'QUANTIX_SUPER_ADMIN', 'QUANTIX_SALES_TEAM']")
    expect(CORE_BUSINESS).toContain('const business = await updateBusiness(businessId, body)')
  })
})

describe('no calculation was changed', () => {
  it('the licensing route still writes the same records', () => {
    expect(LICENSING).toContain('laundryScalingLimit.upsert')
    expect(LICENSING).toContain('DEFAULT_SCALING')
  })

  it('the store-limit resolver is untouched by this change', () => {
    const resolver = read('src/lib/laundry-scaling-limits.ts')
    expect(resolver).toContain('resolveEffectiveStoreLimit')
    expect(resolver).not.toContain('QUANTIX_SUPER_ADMIN')
  })
})
