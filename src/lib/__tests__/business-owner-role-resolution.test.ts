import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// ============================================================================
// Business Owner → Business Owner role → full access.
//
// ROOT CAUSE this pins: two BusinessUser markers mean "owns this business".
// Super Admin Business Creation → Provisioning writes CLIENT_OWNER; the
// laundry-native path writes LAUNDRY_OWNER. isOwnerRole() recognised only
// LAUNDRY_OWNER, so a Super-Admin-provisioned owner matched nothing, fell
// through to resolveUnassignedPermissions() and received NO ACCESS — no
// screens, no navigation, 403 everywhere, and "—" in the Role column because
// they hold every permission yet have no LaundryAccessAssignment row.
//
// The Business Owner system role was never the problem; nobody resolved to it.
// ============================================================================

const mocks = vi.hoisted(() => ({
  findAssignment: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: { laundryAccessAssignment: { findFirst: mocks.findAssignment } },
}))

import {
  isOwnerRole, isBusinessOwnerRole, OWNER_BUSINESS_ROLES, resolveUserPermissions,
} from '@/lib/laundry-rbac'
import { allScreenKeys, Level } from '@/lib/laundry-rbac-registry'
import { SYSTEM_ROLES } from '@/lib/laundry-rbac-catalog'

const BIZ = 'platform-biz-1'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.findAssignment.mockResolvedValue(null)
})

// ── The owner relationship ─────────────────────────────────────────────────
describe('both owner markers are recognised', () => {
  it('CLIENT_OWNER — written by Super Admin Business Creation / Provisioning', () => {
    // This is the case that was broken.
    expect(isOwnerRole('CLIENT_OWNER')).toBe(true)
    expect(isBusinessOwnerRole('CLIENT_OWNER')).toBe(true)
  })

  it('LAUNDRY_OWNER — written by the laundry-native path', () => {
    expect(isOwnerRole('LAUNDRY_OWNER')).toBe(true)
    expect(isBusinessOwnerRole('LAUNDRY_OWNER')).toBe(true)
  })

  it('and nothing else is an owner', () => {
    for (const r of ['STORE_MANAGER', 'STORE_EXECUTIVE', 'PROCESSING_STAFF', 'QC_EXECUTIVE', 'CUSTOMER', '', null, undefined]) {
      expect(isBusinessOwnerRole(r as string | null | undefined)).toBe(false)
    }
    expect(OWNER_BUSINESS_ROLES).toEqual(['CLIENT_OWNER', 'LAUNDRY_OWNER'])
  })
})

// ── Full access, from the EXISTING system role ─────────────────────────────
describe('the owner resolves to the Business Owner system role with full access', () => {
  for (const marker of OWNER_BUSINESS_ROLES) {
    it(`${marker} → BUSINESS_OWNER, every screen at EDIT`, async () => {
      const r = await resolveUserPermissions(BIZ, 'u-owner', marker)
      expect(r.isOwner).toBe(true)
      expect(r.roleCode).toBe('BUSINESS_OWNER')
      expect(r.roleName).toBe('Business Owner')
      expect(r.source).toBe('owner')
      // Full access means EVERY screen, not a copied subset.
      expect(r.permissions.size).toBe(allScreenKeys().length)
      for (const sk of allScreenKeys()) expect(r.levels.get(sk)).toBe(Level.EDIT)
    })
  }

  it('matches the Business Owner role already defined in Roles & Permissions', () => {
    // No new role, no duplicate: the resolver names the system role that exists.
    const sys = SYSTEM_ROLES.find((r) => r.code === 'BUSINESS_OWNER')
    expect(sys).toBeDefined()
    expect(sys!.isOwner).toBe(true)
    expect(sys!.name).toBe('Business Owner')
    expect(sys!.screens()).toHaveLength(allScreenKeys().length)
  })

  it('does not need a LaundryAccessAssignment — access comes from the relationship', async () => {
    // The owner has no assignment row; that is exactly why Role showed "—".
    const r = await resolveUserPermissions(BIZ, 'u-owner', 'CLIENT_OWNER')
    expect(r.isOwner).toBe(true)
    expect(mocks.findAssignment).not.toHaveBeenCalled()
  })

  it('cannot be downgraded by an employee-role assignment', async () => {
    // The owner check runs BEFORE the assignment lookup, so a stray assignment
    // never reduces the owner.
    mocks.findAssignment.mockResolvedValue({
      role: { isActive: true, isOwner: false, code: 'VIEWER', name: 'Viewer', permissions: [] },
    })
    const r = await resolveUserPermissions(BIZ, 'u-owner', 'CLIENT_OWNER')
    expect(r.isOwner).toBe(true)
    expect(r.roleCode).toBe('BUSINESS_OWNER')
  })
})

// ── Employees are unaffected ───────────────────────────────────────────────
describe('a normal employee still gets only their assigned role', () => {
  it('receives exactly the permissions of the assigned role', async () => {
    mocks.findAssignment.mockResolvedValue({
      role: {
        isActive: true, isOwner: false, code: 'COUNTER', name: 'Counter Executive',
        permissions: [
          { permKey: 'laundry.orders', level: Level.VIEW, effect: 'ALLOW' },
          { permKey: 'laundry.new_order', level: Level.CREATE, effect: 'ALLOW' },
        ],
      },
    })
    const r = await resolveUserPermissions(BIZ, 'u-staff', 'STORE_EXECUTIVE')
    expect(r.isOwner).toBe(false)
    expect(r.roleName).toBe('Counter Executive')
    expect(r.levels.get('laundry.orders')).toBe(Level.VIEW)
    expect(r.levels.get('laundry.new_order')).toBe(Level.CREATE)
    // Not full access.
    expect(r.permissions.size).toBeLessThan(allScreenKeys().length)
    expect(r.permissions.has('laundry.settings')).toBe(false)
  })

  it('an unassigned employee still gets nothing', async () => {
    mocks.findAssignment.mockResolvedValue(null)
    const r = await resolveUserPermissions(BIZ, 'u-staff', 'STORE_EXECUTIVE')
    expect(r.isOwner).toBe(false)
    expect(r.permissions.size).toBe(0)
    expect(r.roleName).toBe('No Access')
  })
})

// ── Super Admin stays platform, and stays distinct ─────────────────────────
describe('Quantix Super Admin remains separate from Business Owner', () => {
  it('platform staff resolve as owner within a tenant but keep their own label', async () => {
    const r = await resolveUserPermissions(BIZ, 'u-super', 'QUANTIX_SUPER_ADMIN')
    expect(r.isOwner).toBe(true)
    // Not relabelled as the tenant's Business Owner.
    expect(r.roleCode).toBe('QUANTIX_SUPER_ADMIN')
    expect(r.roleCode).not.toBe('BUSINESS_OWNER')
  })

  it('a Business Owner is NOT a platform role', async () => {
    // Platform authority comes from User.platformRole; these markers are
    // business-scoped and confer nothing platform-wide.
    const { isPlatformRole } = await import('@/lib/permissions')
    for (const marker of OWNER_BUSINESS_ROLES) expect(isPlatformRole(marker)).toBe(false)
  })
})

// ── Structural guarantees ──────────────────────────────────────────────────
describe('business isolation and owner-account compatibility', () => {
  const read = (p: string) => readFileSync(join(__dirname, '../../..', p), 'utf8')

  it('tenant resolution is scoped to the business, so owner A cannot reach business B', () => {
    // getLaundryAuthContext looks up BusinessUser for THIS business only; with
    // no row it returns null and every guard answers 401.
    const auth = read('src/lib/laundry-auth.ts')
    expect(auth).toContain('businessId: laundryBusiness.platformBusinessId || undefined')
    expect(auth).toContain('isActive: true')
  })

  it('Owner Account edits never touch the owner relationship', () => {
    // Name / phone / email / password all update the User row. The
    // BusinessUser link that carries the role is not written, so changing
    // credentials can never cost the owner their access.
    const ownerRoute = read('src/app/api/admin/businesses/[businessId]/owner/route.ts')
    expect(ownerRoute).toContain('db.user.update')
    expect(ownerRoute).not.toContain('db.businessUser.update')
    expect(ownerRoute).not.toContain('db.businessUser.create')
  })

  it('the Staff list shows the owner as Business Owner, not "—"', () => {
    const staff = read('src/app/api/laundry/staff/route.ts')
    expect(staff).toContain('isBusinessOwnerRole(bu.role)')
    expect(staff).toContain("roleCode: a?.role.code ?? (owner ? \"BUSINESS_OWNER\" : null)")
  })

  it('the owner cannot be demoted or deactivated on the Staff screen', () => {
    const edit = read('src/app/api/laundry/staff/[userId]/route.ts')
    expect(edit).toContain('isBusinessOwnerRole(bu.role)')
    expect(edit).toContain('cannot be deactivated or have their role changed')
  })
})
