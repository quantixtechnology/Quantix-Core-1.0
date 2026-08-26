import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
// Store Admin PWA login — Employee ID authentication.
//
// Root cause: the original route only did prisma.user.findFirst({ where: { email } }),
// so V8EMP008 + correct password returned "Incorrect email or password".
//
// Fix: port the core auth route's employee-ID resolution into the store-admin
// login route — resolveTenantByEmployeeId → BusinessUser.employeeCode → User.
// ============================================================================

const mocks = vi.hoisted(() => ({
  tenantIdentityFindUnique: vi.fn(),
  businessUserFindFirst: vi.fn(),
  userFindUnique: vi.fn(),
  userFindFirst: vi.fn(),
  userUpdate: vi.fn(),
  refreshTokenCreate: vi.fn(),
  accessAssignmentFindMany: vi.fn(),
  laundryStoreFindFirst: vi.fn(),
  businessFindUnique: vi.fn(),
  resolveLaundryBusiness: vi.fn(),
  sessionMatchesHostTenant: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    tenantIdentity: { findUnique: mocks.tenantIdentityFindUnique },
    businessUser: { findFirst: mocks.businessUserFindFirst },
    user: {
      findUnique: mocks.userFindUnique,
      findFirst: mocks.userFindFirst,
      update: mocks.userUpdate,
    },
    refreshToken: { create: mocks.refreshTokenCreate },
    laundryAccessAssignment: { findMany: mocks.accessAssignmentFindMany },
    laundryStore: { findFirst: mocks.laundryStoreFindFirst },
    business: { findUnique: mocks.businessFindUnique },
  },
}))
vi.mock('@/lib/laundry-business', () => ({ resolveLaundryBusiness: mocks.resolveLaundryBusiness }))
vi.mock('@/lib/image-url', () => ({ resolveImageUrl: (u: string) => u }))
vi.mock('@/lib/pwa-tenant-boundary', () => ({
  sessionMatchesHostTenant: mocks.sessionMatchesHostTenant,
  TENANT_MISMATCH_MESSAGE: 'Tenant mismatch',
}))
vi.mock('@/lib/laundry-store-admin-auth', () => ({
  STORE_ADMIN_ROLES: new Set(['STORE_MANAGER', 'COUNTER_EXECUTIVE', 'STORE_SUPERVISOR']),
  isCrossTenantRole: (r: string | null) => r === 'QUANTIX_SUPER_ADMIN' || r === 'PLATFORM_ADMIN',
  CROSS_TENANT_ROLES: ['QUANTIX_SUPER_ADMIN', 'PLATFORM_ADMIN'],
}))

// verifyPassword: hash-unaware mock — returns true when password === 'correct'
vi.mock('@/lib/password-utils', () => ({
  verifyPassword: vi.fn(async (pw: string, _hash: string) => pw === 'correct'),
  createAccessToken: vi.fn(() => 'tok_test_' + Math.random()),
}))

import { POST } from '@/app/api/laundry/store-admin/auth/login/route'

function req(body: Record<string, unknown>) {
  return new Request('http://store.vastrasudha.co.in/api/laundry/store-admin/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const USER_ROW = { id: 'u-8', name: 'Test Staff', passwordHash: 'hash', isActive: true, platformRole: null }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.resolveLaundryBusiness.mockResolvedValue({ id: 'lb_vs', platformBusinessId: 'biz_vastrasudha' })
  mocks.userUpdate.mockResolvedValue({})
  mocks.businessFindUnique.mockResolvedValue({ name: 'VASTRASUDHA', logo: null })
  mocks.accessAssignmentFindMany.mockResolvedValue([
    { storeId: 'st-1', businessId: 'biz_vastrasudha', role: { code: 'STORE_MANAGER', name: 'Store Manager', isActive: true } },
  ])
  mocks.laundryStoreFindFirst.mockResolvedValue({ id: 'st-1', storeName: 'Test Store', storeCode: 'TST' })
})

describe('Employee ID login via store-admin/auth/login', () => {
  it('authenticates V8EMP008 with correct password', async () => {
    // Step 1: resolveTenantByEmployeeId finds the tenant
    mocks.tenantIdentityFindUnique.mockResolvedValue({ businessId: 'biz_vastrasudha', prefix: 'V8' })
    // Step 2: BusinessUser lookup finds the user
    mocks.businessUserFindFirst.mockResolvedValue({ userId: 'u-8' })
    // Step 3: User lookup
    mocks.userFindUnique.mockResolvedValue(USER_ROW)

    const res = await POST(req({ identifier: 'V8EMP008', password: 'correct' }))
    const j = await res.json()

    expect(res.status).toBe(200)
    expect(j.success).toBe(true)
    expect(j.data.token).toBeTruthy()
    expect(j.data.staff.name).toBe('Test Staff')

    // Verify the employee-ID resolution path was used
    expect(mocks.tenantIdentityFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ prefix: 'V8' }) }),
    )
    expect(mocks.businessUserFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ employeeCode: 'V8EMP008' }) }),
    )
  })

  it('rejects valid employee ID with wrong password', async () => {
    mocks.tenantIdentityFindUnique.mockResolvedValue({ businessId: 'biz_vastrasudha', prefix: 'V8' })
    mocks.businessUserFindFirst.mockResolvedValue({ userId: 'u-8' })
    mocks.userFindUnique.mockResolvedValue(USER_ROW)

    const res = await POST(req({ identifier: 'V8EMP008', password: 'wrong' }))
    const j = await res.json()

    expect(res.status).toBe(401)
    expect(j.error).toContain('Employee ID')
  })

  it('rejects malformed employee ID (no tenant prefix)', async () => {
    mocks.tenantIdentityFindUnique.mockResolvedValue(null)
    // Falls through to loginId/email lookup — no user found
    mocks.userFindFirst.mockResolvedValue(null)

    const res = await POST(req({ identifier: 'BOGUS999', password: 'correct' }))
    const j = await res.json()

    expect(res.status).toBe(401)
  })

  it('rejects well-formed employee ID with no matching BusinessUser', async () => {
    mocks.tenantIdentityFindUnique.mockResolvedValue({ businessId: 'biz_vastrasudha', prefix: 'V8' })
    mocks.businessUserFindFirst.mockResolvedValue(null) // no BusinessUser

    const res = await POST(req({ identifier: 'V8EMP999', password: 'correct' }))
    const j = await res.json()

    expect(res.status).toBe(401)
    expect(j.error).toContain('Employee ID')
  })

  it('falls back to email when identifier is not an employee ID', async () => {
    // Not a valid employee ID → resolveTenantByEmployeeId returns null
    mocks.tenantIdentityFindUnique.mockResolvedValue(null)
    // Falls to loginId/email lookup
    mocks.userFindFirst.mockResolvedValue(USER_ROW)

    const res = await POST(req({ identifier: 'staff@example.com', password: 'correct' }))
    const j = await res.json()

    expect(res.status).toBe(200)
    expect(j.success).toBe(true)
  })

  it('rejects empty identifier', async () => {
    const res = await POST(req({ identifier: '', password: 'correct' }))
    expect(res.status).toBe(400)
  })

  it('rejects empty password', async () => {
    mocks.tenantIdentityFindUnique.mockResolvedValue({ businessId: 'biz_vastrasudha', prefix: 'V8' })
    const res = await POST(req({ identifier: 'V8EMP008', password: '' }))
    expect(res.status).toBe(400)
  })

  it('accepts the legacy "email" field for backward compatibility', async () => {
    mocks.tenantIdentityFindUnique.mockResolvedValue({ businessId: 'biz_vastrasudha', prefix: 'V8' })
    mocks.businessUserFindFirst.mockResolvedValue({ userId: 'u-8' })
    mocks.userFindUnique.mockResolvedValue(USER_ROW)

    const res = await POST(req({ email: 'V8EMP008', password: 'correct' }))
    const j = await res.json()

    expect(res.status).toBe(200)
    expect(j.success).toBe(true)
  })
})
