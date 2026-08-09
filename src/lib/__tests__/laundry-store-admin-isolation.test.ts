import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
// Store Admin PWA — tenant isolation.
//
// The breach: the cross-tenant branch was gated on isPlatformRole(), which is
// true for THIRTEEN roles — sales, HR, finance, support, deployment, a
// read-only auditor. Any of them signing into the store app received every
// business and every store in the platform.
//
// Cross-tenant access belongs to the platform administrators alone. Everyone
// else is pinned to the single store their assignment binds them to, on the
// SERVER — query parameters are ignored, so the UI is not the boundary.
// ============================================================================

const mocks = vi.hoisted(() => ({
  refreshFindFirst: vi.fn(),
  userFindUnique: vi.fn(),
  assignFindFirst: vi.fn(),
  storeFindFirst: vi.fn(),
  resolveLaundryBusiness: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    refreshToken: { findFirst: mocks.refreshFindFirst },
    user: { findUnique: mocks.userFindUnique },
    laundryAccessAssignment: { findFirst: mocks.assignFindFirst },
    laundryStore: { findFirst: mocks.storeFindFirst },
  },
}))
vi.mock('@/lib/laundry-business', () => ({ resolveLaundryBusiness: mocks.resolveLaundryBusiness }))
vi.mock('@/lib/laundry-executive-auth', () => ({ bearerToken: () => 'tok' }))

import {
  resolveStoreAdmin, resolveStoreScope, isCrossTenantRole, CROSS_TENANT_ROLES, STORE_ADMIN_ROLES,
} from '@/lib/laundry-store-admin-auth'

/** Every platform role that must NOT cross a tenant boundary here. */
const NON_ADMIN_PLATFORM_ROLES = [
  'SALES_MANAGER', 'BD_EXECUTIVE', 'HR_ADMIN', 'FINANCE_MANAGER', 'OPERATIONS_MANAGER',
  'SUPPORT_MANAGER', 'READ_ONLY_AUDITOR', 'QUANTIX_SALES_TEAM', 'SUPPORT_TEAM',
  'DEPLOYMENT_TEAM', 'FINANCE_TEAM',
]

beforeEach(() => {
  vi.clearAllMocks()
  mocks.refreshFindFirst.mockResolvedValue({ userId: 'u-1' })
  mocks.assignFindFirst.mockResolvedValue(null)
  mocks.resolveLaundryBusiness.mockResolvedValue({ id: 'lb-1' })
  mocks.storeFindFirst.mockResolvedValue({ id: 'store-1' })
})

// Pins the breach itself. isPlatformRole is a legitimate function used
// elsewhere; the defect was reaching for it as a store-app authorisation gate.
describe('the gate that leaked', () => {
  it('isPlatformRole still admits the eleven roles that must not cross tenants', async () => {
    const { isPlatformRole } = await import('@/lib/permissions')
    for (const role of NON_ADMIN_PLATFORM_ROLES) expect(isPlatformRole(role)).toBe(true)
    // …and none of them may be treated as cross-tenant here.
    for (const role of NON_ADMIN_PLATFORM_ROLES) expect(isCrossTenantRole(role)).toBe(false)
  })
})

describe('who may cross a tenant boundary', () => {
  it('admits the platform administrators', () => {
    expect(isCrossTenantRole('QUANTIX_SUPER_ADMIN')).toBe(true)
    expect(isCrossTenantRole('PLATFORM_ADMIN')).toBe(true)
  })

  it.each(NON_ADMIN_PLATFORM_ROLES)('refuses %s', (role) => {
    expect(isCrossTenantRole(role)).toBe(false)
  })

  it('refuses a tenant role and a missing role', () => {
    expect(isCrossTenantRole('LAUNDRY_OWNER')).toBe(false)
    expect(isCrossTenantRole(null)).toBe(false)
    expect(isCrossTenantRole(undefined)).toBe(false)
  })

  it('keeps the allowlist to exactly the two administrators', () => {
    expect([...CROSS_TENANT_ROLES].sort()).toEqual(['PLATFORM_ADMIN', 'QUANTIX_SUPER_ADMIN'])
  })
})

describe('session resolution', () => {
  it('gives a Super Admin an unrestricted session', async () => {
    mocks.userFindUnique.mockResolvedValue({ isActive: true, platformRole: 'QUANTIX_SUPER_ADMIN' })
    expect(await resolveStoreAdmin('tok')).toMatchObject({ isSuperAdmin: true })
  })

  // The reported bug, as a test: these accounts used to receive every business.
  it.each(NON_ADMIN_PLATFORM_ROLES)('does not hand %s an unrestricted session', async (role) => {
    mocks.userFindUnique.mockResolvedValue({ isActive: true, platformRole: role })
    // No store assignment → refused outright rather than promoted.
    expect(await resolveStoreAdmin('tok')).toBeNull()
  })

  it('pins store staff to the one store their assignment binds', async () => {
    mocks.userFindUnique.mockResolvedValue({ isActive: true, platformRole: null })
    mocks.assignFindFirst.mockResolvedValue({
      storeId: 'store-1', businessId: 'pb-1', role: { code: 'STORE_MANAGER', name: 'Store Manager', isActive: true },
    })
    const s = await resolveStoreAdmin('tok')
    expect(s).toMatchObject({ isSuperAdmin: false, businessId: 'lb-1', storeId: 'store-1' })
  })

  it('refuses a role outside the store-operational set', async () => {
    mocks.userFindUnique.mockResolvedValue({ isActive: true, platformRole: null })
    mocks.assignFindFirst.mockResolvedValue({
      storeId: 'store-1', businessId: 'pb-1', role: { code: 'ACCOUNTANT', name: 'Accountant', isActive: true },
    })
    expect(await resolveStoreAdmin('tok')).toBeNull()
    expect(STORE_ADMIN_ROLES.has('ACCOUNTANT')).toBe(false)
  })

  it('refuses a deactivated user', async () => {
    mocks.userFindUnique.mockResolvedValue({ isActive: false, platformRole: 'QUANTIX_SUPER_ADMIN' })
    expect(await resolveStoreAdmin('tok')).toBeNull()
  })

  it('refuses an unknown token', async () => {
    mocks.refreshFindFirst.mockResolvedValue(null)
    expect(await resolveStoreAdmin('tok')).toBeNull()
  })
})

// Isolation is enforced on the server, so tampering with the request cannot
// widen it. This is the check that makes the UI not the boundary.
describe('scope resolution ignores client input for store staff', () => {
  const staff = { userId: 'u-1', isSuperAdmin: false, businessId: 'lb-1', storeId: 'store-1' }
  const req = (qs: string) => new Request(`http://x/api?${qs}`)

  it('returns the bound store, whatever the query says', async () => {
    const scope = await resolveStoreScope(staff, req('businessId=lb-OTHER&storeId=store-OTHER'))
    expect(scope).toEqual({ businessId: 'lb-1', storeId: 'store-1' })
  })

  it('never consults the database for a store-staff scope', async () => {
    await resolveStoreScope(staff, req('businessId=lb-OTHER&storeId=store-OTHER'))
    expect(mocks.resolveLaundryBusiness).not.toHaveBeenCalled()
    expect(mocks.storeFindFirst).not.toHaveBeenCalled()
  })

  it('lets a Super Admin target a business they name', async () => {
    const scope = await resolveStoreScope({ userId: 'u-1', isSuperAdmin: true }, req('businessId=pb-2&storeId=store-9'))
    expect(scope).toEqual({ businessId: 'lb-1', storeId: 'store-9' })
  })

  it('refuses a Super Admin store that does not belong to the named business', async () => {
    mocks.storeFindFirst.mockResolvedValue(null)
    expect(await resolveStoreScope({ userId: 'u-1', isSuperAdmin: true }, req('businessId=pb-2&storeId=store-elsewhere'))).toBeNull()
  })

  it('refuses a Super Admin who has not chosen a store yet', async () => {
    expect(await resolveStoreScope({ userId: 'u-1', isSuperAdmin: true }, req(''))).toBeNull()
  })
})
