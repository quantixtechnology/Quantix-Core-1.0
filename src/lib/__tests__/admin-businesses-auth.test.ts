import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
// Platform business-administration routes must be platform-admin only.
//
// withMiddleware enforces `requiredPermission` ONLY inside its `requireAuth`
// branch. Four routes carried a permission but no requireAuth, so the check was
// inert and they answered anyone: create a business, assign its product/plan,
// read provisioning progress, list the product catalogue.
//
// These tests drive the REAL middleware — only the database and the handlers'
// downstream work are mocked — so they check the guard as it actually runs,
// not the shape of the config object.
// ============================================================================

const mocks = vi.hoisted(() => ({
  findRefreshToken: vi.fn(),
  getPermissions: vi.fn(),
  provisionBusiness: vi.fn(),
  getProvisioningStatus: vi.fn(),
  assignProductToBusiness: vi.fn(),
  validateProductAssignment: vi.fn(),
  availableProducts: vi.fn(),
  businessCreate: vi.fn(),
  businessFindUnique: vi.fn(),
  businessFindFirst: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    refreshToken: { findUnique: mocks.findRefreshToken },
    business: {
      create: mocks.businessCreate,
      findUnique: mocks.businessFindUnique,
      findFirst: mocks.businessFindFirst,
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    businessUser: { findFirst: vi.fn().mockResolvedValue(null) },
    order: { groupBy: vi.fn().mockResolvedValue([]) },
  },
}))
vi.mock('@/lib/db-permissions', () => ({ getDbPermissionsForRole: mocks.getPermissions }))
vi.mock('@/lib/tenant-resolver', () => ({ resolveTenantFromHostname: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/product-hosts', () => ({ getReservedHostPrefixes: () => [] as string[] }))
vi.mock('@/lib/business-provisioning', () => ({
  provisionBusiness: mocks.provisionBusiness,
  getProvisioningStatus: mocks.getProvisioningStatus,
}))
vi.mock('@/lib/business-product-assignment', () => ({
  assignProductToBusiness: mocks.assignProductToBusiness,
  validateProductAssignment: mocks.validateProductAssignment,
  getAvailableProductsForCreation: mocks.availableProducts,
}))

import { POST as CREATE_BUSINESS } from '@/app/api/admin/businesses/route'
import { POST as PROVISION, GET as PROVISION_STATUS } from '@/app/api/admin/businesses/provision/route'
import { POST as ASSIGN_PRODUCT } from '@/app/api/admin/businesses/assign-product/route'
import { GET as LIST_PRODUCTS } from '@/app/api/admin/businesses/products/route'

// ── Callers ────────────────────────────────────────────────────────────────
const SUPER_ADMIN = {
  id: 'u-super', email: 'superadmin@quantixtechnology.in', name: 'Super Admin',
  isActive: true, platformRole: 'QUANTIX_SUPER_ADMIN', businessUsers: [], salesProfile: null,
}
// A real tenant user: the owner of their own business, with no platform role.
const TENANT_OWNER = {
  id: 'u-owner', email: 'owner@tenant.com', name: 'Tenant Owner',
  isActive: true, platformRole: null,
  businessUsers: [{ role: 'CLIENT_OWNER', storeId: null, business: { id: 'biz-tenant', name: 'Tenant', businessType: 'GROCERY', slug: 'tenant' } }],
  salesProfile: null,
}

const asUser = (user: unknown) =>
  mocks.findRefreshToken.mockResolvedValue({ token: 't', expiresAt: new Date(Date.now() + 3_600_000), user })

const AUTH = { authorization: 'Bearer test-token' }
const body = {
  businessName: 'Acme', slug: 'acme', email: 'owner@acme.com', phone: '9000000000',
  address1: '1 Road', city: 'Bengaluru', state: 'Karnataka', pincode: '560001',
}

const post = (url: string, headers: Record<string, string> = {}, payload: any = body) =>
  new Request(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(payload) })
const get = (url: string, headers: Record<string, string> = {}) => new Request(url, { headers })

beforeEach(() => {
  vi.clearAllMocks()
  // Grant every permission, so a rejection can only come from the auth/platform
  // gate — never from a missing permission that would mask it.
  mocks.getPermissions.mockResolvedValue(['businesses:create', 'businesses:view', 'businesses:edit', 'businesses:update'])
  mocks.businessFindFirst.mockResolvedValue(null)
  mocks.businessFindUnique.mockResolvedValue(null)
  mocks.businessCreate.mockResolvedValue({ id: 'biz-new', name: 'Acme', slug: 'acme', status: 'ONBOARDING' })
  mocks.provisionBusiness.mockResolvedValue({ success: true, workspaceId: 'ws-1', steps: [] })
  mocks.getProvisioningStatus.mockResolvedValue({ status: 'COMPLETED', steps: [] })
  mocks.assignProductToBusiness.mockResolvedValue({ id: 'biz-1', productCode: 'LAUNDRY', productVersion: '1.0', subscriptionPlanCode: 'PRO', enabledFeatures: '[]' })
  mocks.validateProductAssignment.mockResolvedValue({ valid: true, errors: [] })
  mocks.availableProducts.mockResolvedValue([{ code: 'LAUNDRY', name: 'Laundry OS' }])
})

// ── Business Creation ──────────────────────────────────────────────────────
describe('POST /api/admin/businesses — Business Creation', () => {
  it('rejects an unauthenticated request', async () => {
    const res = await CREATE_BUSINESS(post('http://x/api/admin/businesses') as never)
    expect(res.status).toBe(401)
    // The business must not exist as a side effect of a refused request.
    expect(mocks.businessCreate).not.toHaveBeenCalled()
  })

  it('rejects an authenticated tenant user', async () => {
    asUser(TENANT_OWNER)
    const res = await CREATE_BUSINESS(post('http://x/api/admin/businesses', AUTH) as never)
    expect(res.status).toBe(403)
    expect(mocks.businessCreate).not.toHaveBeenCalled()
  })

  it('allows a platform Super Admin, and creation still works', async () => {
    asUser(SUPER_ADMIN)
    const res = await CREATE_BUSINESS(post('http://x/api/admin/businesses', AUTH) as never)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.id).toBe('biz-new')
    // Unchanged creation logic: the same fields still reach the same write.
    expect(mocks.businessCreate).toHaveBeenCalledTimes(1)
    const written = mocks.businessCreate.mock.calls[0][0].data
    expect(written.name).toBe('Acme')
    expect(written.slug).toBe('acme')
    expect(written.contactEmail).toBe('owner@acme.com')
  })

  it('still validates its inputs for an authorised caller', async () => {
    // The guard must not have swallowed the route's own validation.
    asUser(SUPER_ADMIN)
    const res = await CREATE_BUSINESS(post('http://x/api/admin/businesses', AUTH, { ...body, slug: '' }) as never)
    expect(res.status).toBe(400)
    expect(mocks.businessCreate).not.toHaveBeenCalled()
  })
})

// ── Provisioning ───────────────────────────────────────────────────────────
describe('POST /api/admin/businesses/provision', () => {
  const payload = { businessId: 'biz-1' }

  it('rejects an unauthenticated request', async () => {
    const res = await PROVISION(post('http://x/api/admin/businesses/provision', {}, payload) as never)
    expect(res.status).toBe(401)
    expect(mocks.provisionBusiness).not.toHaveBeenCalled()
  })

  it('rejects an authenticated tenant user', async () => {
    asUser(TENANT_OWNER)
    const res = await PROVISION(post('http://x/api/admin/businesses/provision', AUTH, payload) as never)
    expect(res.status).toBe(403)
    expect(mocks.provisionBusiness).not.toHaveBeenCalled()
  })

  it('allows a platform Super Admin, and provisioning still works', async () => {
    asUser(SUPER_ADMIN)
    const res = await PROVISION(post('http://x/api/admin/businesses/provision', AUTH, payload) as never)
    expect(res.status).toBe(200)
    expect(mocks.provisionBusiness).toHaveBeenCalledWith('biz-1', expect.any(Object))
  })

  it('still passes the owner details through unchanged', async () => {
    // Owner Account behaviour must be unaffected by the guard change.
    asUser(SUPER_ADMIN)
    await PROVISION(post('http://x/api/admin/businesses/provision', AUTH, {
      businessId: 'biz-1', ownerPassword: 'Secret123', confirmPassword: 'Secret123',
      ownerName: 'Real Owner', ownerEmail: 'real@owner.com', ownerPhone: '9111111111',
    }) as never)
    expect(mocks.provisionBusiness).toHaveBeenCalledWith('biz-1', {
      ownerPassword: 'Secret123', ownerName: 'Real Owner', ownerEmail: 'real@owner.com', ownerPhone: '9111111111',
    })
  })

  it('still rejects a mismatched owner password for an authorised caller', async () => {
    asUser(SUPER_ADMIN)
    const res = await PROVISION(post('http://x/api/admin/businesses/provision', AUTH, {
      businessId: 'biz-1', ownerPassword: 'Secret123', confirmPassword: 'Secret124',
    }) as never)
    expect(res.status).toBe(400)
    expect(mocks.provisionBusiness).not.toHaveBeenCalled()
  })
})

describe('GET /api/admin/businesses/provision — provisioning status', () => {
  const url = 'http://x/api/admin/businesses/provision?businessId=biz-1'

  it('rejects an unauthenticated request', async () => {
    const res = await PROVISION_STATUS(get(url) as never)
    expect(res.status).toBe(401)
    // A tenant's provisioning progress is not public information.
    expect(mocks.getProvisioningStatus).not.toHaveBeenCalled()
  })

  it('rejects an authenticated tenant user', async () => {
    asUser(TENANT_OWNER)
    const res = await PROVISION_STATUS(get(url, AUTH) as never)
    expect(res.status).toBe(403)
    expect(mocks.getProvisioningStatus).not.toHaveBeenCalled()
  })

  it('allows a platform Super Admin, and status still works', async () => {
    asUser(SUPER_ADMIN)
    const res = await PROVISION_STATUS(get(url, AUTH) as never)
    expect(res.status).toBe(200)
    expect((await res.json()).data.status).toBe('COMPLETED')
  })
})

// ── The two the audit turned up ────────────────────────────────────────────
describe('POST /api/admin/businesses/assign-product', () => {
  const payload = { businessId: 'biz-1', productCode: 'LAUNDRY', subscriptionPlanCode: 'PRO' }

  it('rejects an unauthenticated request', async () => {
    const res = await ASSIGN_PRODUCT(post('http://x/api/admin/businesses/assign-product', {}, payload) as never)
    expect(res.status).toBe(401)
    // Licensing decides what a tenant is entitled to.
    expect(mocks.assignProductToBusiness).not.toHaveBeenCalled()
  })

  it('rejects an authenticated tenant user', async () => {
    asUser(TENANT_OWNER)
    const res = await ASSIGN_PRODUCT(post('http://x/api/admin/businesses/assign-product', AUTH, payload) as never)
    expect(res.status).toBe(403)
    expect(mocks.assignProductToBusiness).not.toHaveBeenCalled()
  })

  it('allows a platform Super Admin', async () => {
    asUser(SUPER_ADMIN)
    const res = await ASSIGN_PRODUCT(post('http://x/api/admin/businesses/assign-product', AUTH, payload) as never)
    expect(res.status).toBe(200)
    expect(mocks.assignProductToBusiness).toHaveBeenCalled()
  })
})

describe('GET /api/admin/businesses/products', () => {
  const url = 'http://x/api/admin/businesses/products'

  it('rejects an unauthenticated request', async () => {
    // The file already declared "Super Admin only"; now it is true.
    const res = await LIST_PRODUCTS(get(url) as never)
    expect(res.status).toBe(401)
    expect(mocks.availableProducts).not.toHaveBeenCalled()
  })

  it('rejects an authenticated tenant user', async () => {
    asUser(TENANT_OWNER)
    const res = await LIST_PRODUCTS(get(url, AUTH) as never)
    expect(res.status).toBe(403)
  })

  it('allows a platform Super Admin', async () => {
    asUser(SUPER_ADMIN)
    const res = await LIST_PRODUCTS(get(url, AUTH) as never)
    expect(res.status).toBe(200)
    expect((await res.json()).data).toHaveLength(1)
  })
})

// ── Expired / inactive sessions are not a way in ───────────────────────────
describe('a token is not enough', () => {
  it('an expired session is refused', async () => {
    mocks.findRefreshToken.mockResolvedValue({ token: 't', expiresAt: new Date(Date.now() - 1000), user: SUPER_ADMIN })
    expect((await CREATE_BUSINESS(post('http://x/api/admin/businesses', AUTH) as never)).status).toBe(401)
  })

  it('a deactivated Super Admin is refused', async () => {
    asUser({ ...SUPER_ADMIN, isActive: false })
    expect((await CREATE_BUSINESS(post('http://x/api/admin/businesses', AUTH) as never)).status).toBe(401)
  })

  it('an unknown token is refused', async () => {
    mocks.findRefreshToken.mockResolvedValue(null)
    expect((await CREATE_BUSINESS(post('http://x/api/admin/businesses', AUTH) as never)).status).toBe(401)
  })
})
