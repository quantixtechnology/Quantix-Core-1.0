import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// ============================================================================
// Super Admin → Business → Staff → delete an eligible user.
//
// The requirement that matters most: deleting a login must NEVER delete the
// work that person did. A staff member who processed 500 garments leaves 500
// garments behind.
// ============================================================================

const mocks = vi.hoisted(() => ({
  findRefreshToken: vi.fn(),
  getPermissions: vi.fn(),
  buFindFirst: vi.fn(),
  buCount: vi.fn(),
  buDelete: vi.fn(),
  assignFindFirst: vi.fn(),
  assignUpdate: vi.fn(),
  tokenDeleteMany: vi.fn(),
  userUpdate: vi.fn(),
  auditCreate: vi.fn(),
  resolveBusiness: vi.fn(),
}))

const tx = {
  businessUser: { delete: mocks.buDelete },
  laundryAccessAssignment: { update: mocks.assignUpdate },
  refreshToken: { deleteMany: mocks.tokenDeleteMany },
  user: { update: mocks.userUpdate },
}

vi.mock('@/lib/prisma', () => ({
  prisma: {
    businessUser: { findFirst: mocks.buFindFirst, count: mocks.buCount },
    laundryAccessAssignment: { findFirst: mocks.assignFindFirst },
    laundryAccessAudit: { create: mocks.auditCreate },
    $transaction: (fn: any) => fn(tx),
  },
}))
vi.mock('@/lib/db', () => ({ db: { refreshToken: { findUnique: mocks.findRefreshToken } } }))
vi.mock('@/lib/db-permissions', () => ({ getDbPermissionsForRole: mocks.getPermissions }))
vi.mock('@/lib/tenant-resolver', () => ({ resolveTenantFromHostname: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/laundry-business', () => ({ resolveLaundryBusiness: mocks.resolveBusiness }))

import { DELETE } from '@/app/api/laundry/staff/[userId]/route'
import { staffDeletionRefusal, OWNER_REFUSAL, PLATFORM_REFUSAL, SELF_REFUSAL } from '@/lib/staff-deletion'
import { isBusinessOwnerRole } from '@/lib/laundry-rbac'

const ROOT = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')
const ROUTE = read('src/app/api/laundry/staff/[userId]/route.ts')
const UI = read('src/components/laundry/views/laundry-staff.tsx')

const SUPER_ADMIN = {
  id: 'u-super', email: 'superadmin@quantixtechnology.in', name: 'Super Admin',
  isActive: true, platformRole: 'QUANTIX_SUPER_ADMIN', businessUsers: [], salesProfile: null,
}
const OWNER = {
  id: 'u-owner', email: 'owner@tenant.com', name: 'Owner', isActive: true, platformRole: null,
  businessUsers: [{ role: 'CLIENT_OWNER', storeId: null, business: { id: 'biz-1', name: 'T', businessType: 'GROCERY', slug: 't' } }],
  salesProfile: null,
}
const asUser = (user: unknown) =>
  mocks.findRefreshToken.mockResolvedValue({ token: 't', expiresAt: new Date(Date.now() + 3_600_000), user })

const AUTH = { authorization: 'Bearer test-token' }
const req = (userId = 'u-staff', businessId = 'biz-1', headers: Record<string, string> = AUTH) =>
  new Request(`http://x/api/laundry/staff/${userId}?businessId=${businessId}`, { method: 'DELETE', headers })
const ctx = (userId = 'u-staff') => ({ params: Promise.resolve({ userId }) })

const staffRow = {
  id: 'bu-1', role: 'STORE_EXECUTIVE',
  user: { id: 'u-staff', name: 'PC AUDIT', email: 'pcaudit@gmail.com', platformRole: null },
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getPermissions.mockResolvedValue([])
  mocks.resolveBusiness.mockResolvedValue({ id: 'lb-1', platformBusinessId: 'biz-1' })
  mocks.buFindFirst.mockResolvedValue(staffRow)
  mocks.buCount.mockResolvedValue(0)
  mocks.assignFindFirst.mockResolvedValue(null)
  mocks.auditCreate.mockResolvedValue({})
})

// ── The eligibility rule, on its own ───────────────────────────────────────
describe('who may be deleted', () => {
  const target = (over: Record<string, unknown> = {}) =>
    staffDeletionRefusal({ userId: 'u-staff', platformRole: null, businessRole: 'STORE_EXECUTIVE', ...over }, 'u-super', isBusinessOwnerRole)

  it('a normal employee may be deleted', () => {
    expect(target()).toBeNull()
  })

  it('the Business Owner may not — either owner marker', () => {
    expect(target({ businessRole: 'CLIENT_OWNER' })).toBe(OWNER_REFUSAL)
    expect(target({ businessRole: 'LAUNDRY_OWNER' })).toBe(OWNER_REFUSAL)
    // …nor via an owner RBAC role.
    expect(target({ hasOwnerAssignment: true })).toBe(OWNER_REFUSAL)
    expect(OWNER_REFUSAL).toContain('Transfer ownership first')
  })

  it('platform and system accounts may not', () => {
    expect(target({ platformRole: 'QUANTIX_SUPER_ADMIN' })).toBe(PLATFORM_REFUSAL)
    expect(target({ platformRole: 'PLATFORM_ADMIN' })).toBe(PLATFORM_REFUSAL)
    expect(target({ platformRole: 'SUPPORT_TEAM' })).toBe(PLATFORM_REFUSAL)
  })

  it('you may not delete yourself', () => {
    expect(staffDeletionRefusal({ userId: 'u-super', platformRole: null, businessRole: 'STORE_EXECUTIVE' }, 'u-super', isBusinessOwnerRole)).toBe(SELF_REFUSAL)
  })

  it('protection is decided by the database role, never an email address', () => {
    const src = read('src/lib/staff-deletion.ts')
    expect(src).not.toMatch(/@gmail|@quantixtechnology/)
    expect(src).toContain('platformRole')
  })
})

// ── Authorization ──────────────────────────────────────────────────────────
describe('only Quantix Super Admin can call it', () => {
  it('rejects an unauthenticated caller', async () => {
    const res = await DELETE(req('u-staff', 'biz-1', {}) as never, ctx())
    expect(res.status).toBe(401)
    expect(mocks.buDelete).not.toHaveBeenCalled()
  })

  it('rejects the Business Owner of that very business', async () => {
    // Deliberately NOT a laundry screen permission: this is platform admin.
    asUser(OWNER)
    const res = await DELETE(req() as never, ctx())
    expect(res.status).toBe(403)
    expect(mocks.buDelete).not.toHaveBeenCalled()
  })

  it('allows a Super Admin', async () => {
    asUser(SUPER_ADMIN)
    const res = await DELETE(req() as never, ctx())
    expect(res.status).toBe(200)
    expect((await res.json()).success).toBe(true)
  })

  it('does not depend on a laundry screen permission', () => {
    expect(ROUTE).toContain("requiredRoles: [\"QUANTIX_SUPER_ADMIN\"]")
  })
})

// ── Refusals through the endpoint ──────────────────────────────────────────
describe('the endpoint enforces eligibility, not just the UI', () => {
  it('refuses the Business Owner', async () => {
    asUser(SUPER_ADMIN)
    mocks.buFindFirst.mockResolvedValue({ ...staffRow, role: 'CLIENT_OWNER' })
    const res = await DELETE(req('u-owner') as never, ctx('u-owner'))
    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe(OWNER_REFUSAL)
    expect(mocks.buDelete).not.toHaveBeenCalled()
  })

  it('refuses another Super Admin', async () => {
    asUser(SUPER_ADMIN)
    mocks.buFindFirst.mockResolvedValue({ ...staffRow, user: { ...staffRow.user, platformRole: 'QUANTIX_SUPER_ADMIN' } })
    const res = await DELETE(req('u-other-super') as never, ctx('u-other-super'))
    expect(res.status).toBe(403)
    expect(mocks.buDelete).not.toHaveBeenCalled()
  })

  it('refuses a user who belongs to another business', async () => {
    // Scoped lookup finds nothing, so a manipulated id cannot cross tenants.
    asUser(SUPER_ADMIN)
    mocks.buFindFirst.mockResolvedValue(null)
    const res = await DELETE(req('u-other-biz') as never, ctx('u-other-biz'))
    expect(res.status).toBe(404)
    expect(mocks.buDelete).not.toHaveBeenCalled()
    // The lookup was constrained to the requested business.
    expect(mocks.buFindFirst.mock.calls[0][0].where.businessId).toBe('biz-1')
  })
})

// ── What deletion actually does ────────────────────────────────────────────
describe('deleting a login does not delete their work', () => {
  it('removes membership, role grant and sessions — nothing operational', async () => {
    asUser(SUPER_ADMIN)
    mocks.assignFindFirst.mockResolvedValue({ id: 'a-1', role: { isOwner: false } })
    await DELETE(req() as never, ctx())

    expect(mocks.buDelete).toHaveBeenCalledWith({ where: { id: 'bu-1' } })
    expect(mocks.assignUpdate).toHaveBeenCalledWith({ where: { id: 'a-1' }, data: { active: false } })
    expect(mocks.tokenDeleteMany).toHaveBeenCalledWith({ where: { userId: 'u-staff' } })
  })

  it('touches no operational table', () => {
    // Orders, garments, item events, audits and payments are never referenced.
    for (const table of [
      'laundryOrder', 'laundryOrderItem', 'laundryItemEvent', 'laundryOrderEvent',
      'laundryPayment', 'laundryInvoice', 'laundryGarment', 'laundryBag',
    ]) {
      expect(ROUTE).not.toContain(`${table}.delete`)
      expect(ROUTE).not.toContain(`${table}.deleteMany`)
      expect(ROUTE).not.toContain(`${table}.updateMany`)
    }
  })

  it('never hard-deletes the User — the platform convention is deactivate', () => {
    expect(ROUTE).not.toContain('user.delete')
    expect(ROUTE).toContain('data: { isActive: false }')
  })

  it('no laundry model has a foreign key to User, so history cannot cascade', () => {
    // The structural reason the guarantee holds. LaundryAccessAssignment.userId
    // is a plain String; operational rows store the actor as a name string.
    const schema = read('prisma/schema.prisma')
    const laundryBlocks = schema.split(/\nmodel /).filter((b) => b.startsWith('Laundry'))
    expect(laundryBlocks.length).toBeGreaterThan(10)
    // A relation field is declared as `<name> User[?] @relation(...)`. None of
    // the Laundry models has one, so there is no path from deleting a User into
    // orders, garments, events, audits or payments.
    const userRelation = /^\s*\w+\s+User\??\s+@relation/m
    for (const b of laundryBlocks) {
      expect(b, `Laundry model gained a User relation: ${b.split('\n')[0]}`).not.toMatch(userRelation)
    }
  })
})

describe('removal is scoped to the business', () => {
  it('deactivates the User only when this was their last membership', async () => {
    asUser(SUPER_ADMIN)
    mocks.buCount.mockResolvedValue(0)
    await DELETE(req() as never, ctx())
    expect(mocks.userUpdate).toHaveBeenCalledWith({ where: { id: 'u-staff' }, data: { isActive: false } })
  })

  it('leaves the User active when they still belong to another business', async () => {
    // Removing someone from one tenant must not lock them out of another.
    asUser(SUPER_ADMIN)
    mocks.buCount.mockResolvedValue(1)
    await DELETE(req() as never, ctx())
    expect(mocks.userUpdate).not.toHaveBeenCalled()
    expect(mocks.tokenDeleteMany).toHaveBeenCalled()
  })
})

// ── UI ─────────────────────────────────────────────────────────────────────
describe('the Staff screen', () => {
  it('shows delete only to a platform Super Admin', () => {
    expect(UI).toContain('isPlatformSuperAdmin && (')
    expect(UI).toContain('<Trash2')
  })

  it('disables it for the Business Owner with the reason', () => {
    expect(UI).toContain('Business Owner cannot be deleted. Transfer ownership first.')
    expect(UI).toContain('e.isOwner ? (')
  })

  it('confirms before deleting, and says what survives', () => {
    expect(UI).toContain('Delete Staff Member?')
    expect(UI).toContain('will remain intact')
    expect(UI).toContain('Delete User')
    expect(UI).toContain('Cancel')
  })

  it('reports success and refreshes; leaves the list alone on failure', () => {
    expect(UI).toContain('User deleted successfully.')
    expect(UI).toContain('Delete failed')
  })

  it('the platform-only flag defaults to false while loading', () => {
    // A platform action must never flash into view for a tenant user.
    const hook = read('src/hooks/use-laundry-permissions.ts')
    expect(hook).toContain('const isPlatformSuperAdmin = snap?.roleCode === "QUANTIX_SUPER_ADMIN"')
  })
})

describe('existing staff actions still work', () => {
  it('edit, activate/deactivate and reset-password are untouched', () => {
    expect(ROUTE).toContain('export async function PATCH')
    expect(ROUTE).toContain('laundry.staff.assign_role')
    expect(ROUTE).toContain('laundry.staff.edit')
    expect(UI).toContain('resetPassword')
    expect(UI).toContain('toggleActive')
  })
})
