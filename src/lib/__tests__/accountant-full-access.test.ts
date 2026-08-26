import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
// ACCOUNTANT = FULL ACCESS, one tenant only.
//
// THE BUG: the Accountant catalog entry granted `laundry.orders` at VIEW. The
// executive-assignment endpoints guard on `laundry.orders.create` (pickup) and
// `laundry.orders.edit` (delivery), so requireLaundryLevel compared VIEW(1)
// against CREATE(2)/EDIT(3) and answered 403 "Permission denied" — on a screen
// whose Create permission had, from the operator's point of view, been granted.
//
// THE RULE: a full-access role is resolved from its CODE, not from a stored
// permission list, so it cannot drift and needs no per-screen grant when a
// screen is added. It is reach, NOT ownership, and it is scoped to the one
// business the caller is resolved against.
// ============================================================================

const H = vi.hoisted(() => {
  const state = {
    assignment: null as null | { businessId: string; userId: string; role: { code: string; name: string; isActive: boolean; isOwner: boolean; permissions: { permKey: string; level: number; effect: string }[] } },
  }
  const prisma = {
    laundryAccessAssignment: {
      // Mirrors the real query: ALWAYS scoped to businessId + userId + active.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      findFirst: vi.fn(async (a: any) => {
        const s = state.assignment
        if (!s) return null
        if (s.businessId !== a.where.businessId || s.userId !== a.where.userId) return null
        return { ...s }
      }),
    },
  }
  return { state, prisma }
})

vi.mock('@/lib/prisma', () => ({ prisma: H.prisma }))

import { resolveUserPermissions, isFullAccessRoleCode, FULL_ACCESS_ROLE_CODES, screenLevel } from '@/lib/laundry-rbac'
import { Level, allScreenKeys } from '@/lib/laundry-rbac-registry'
import { fullAccessScreenKeys } from '@/lib/laundry-rbac-catalog'

const { state } = H
const BIZ = 'BUS-202608-0008'
const OTHER_BIZ = 'BUS-202606-0005'
const USER = 'usr-accountant'

const assign = (code: string, over: Partial<{ isActive: boolean; isOwner: boolean; businessId: string; permissions: { permKey: string; level: number; effect: string }[] }> = {}) => {
  state.assignment = {
    businessId: over.businessId ?? BIZ,
    userId: USER,
    role: {
      code, name: code, isActive: over.isActive ?? true, isOwner: over.isOwner ?? false,
      // Deliberately the OLD narrow list — full access must not depend on it.
      permissions: over.permissions ?? [{ permKey: 'laundry.orders.view', level: Level.VIEW, effect: 'ALLOW' }],
    },
  }
}

beforeEach(() => { state.assignment = null; vi.clearAllMocks() })

describe('the full-access rule', () => {
  it('names ACCOUNTANT, matched case-insensitively', () => {
    expect(FULL_ACCESS_ROLE_CODES.has('ACCOUNTANT')).toBe(true)
    expect(isFullAccessRoleCode('accountant')).toBe(true)
    expect(isFullAccessRoleCode(' Accountant ')).toBe(true)
    expect(isFullAccessRoleCode('COUNTER_EXECUTIVE')).toBe(false)
    expect(isFullAccessRoleCode(null)).toBe(false)
  })
})

describe('Accountant permissions', () => {
  it('holds EVERY non-owner-only screen at EDIT — the top level', async () => {
    assign('ACCOUNTANT')
    const r = await resolveUserPermissions(BIZ, USER, 'STORE_EXECUTIVE')
    for (const key of fullAccessScreenKeys()) {
      expect(screenLevel(r.levels, key), key).toBe(Level.EDIT)
    }
    expect(r.roleCode).toBe('ACCOUNTANT')
  })

  it('passes the exact guards that produced the 403', async () => {
    assign('ACCOUNTANT')
    const r = await resolveUserPermissions(BIZ, USER, 'STORE_EXECUTIVE')
    // laundry/executives (view), dispatch/pickup (create), dispatch/delivery (edit)
    expect(screenLevel(r.levels, 'laundry.orders')).toBeGreaterThanOrEqual(Level.EDIT)
    // …and the rest of the screens named in the request.
    for (const key of [
      'laundry.order_detail', 'laundry.customers', 'laundry.delivery_executives',
      'store_ops.payment_collection', 'store_ops.pickup_scheduler', 'store_ops.delivery_assignments',
      'store_ops.dispatch_center', 'store_ops.store_audit', 'laundry.reports',
      'laundry.settings', 'processing.sorting',
    ]) {
      expect(screenLevel(r.levels, key), key).toBe(Level.EDIT)
    }
  })

  it('does NOT depend on the stored permission list (immune to drift)', async () => {
    // A tenant seeded before this change still has only orders.view stored.
    assign('ACCOUNTANT', { permissions: [{ permKey: 'laundry.orders.view', level: Level.VIEW, effect: 'ALLOW' }] })
    const r = await resolveUserPermissions(BIZ, USER, null)
    expect(screenLevel(r.levels, 'laundry.orders')).toBe(Level.EDIT)
  })

  it('works even with NO stored permissions at all', async () => {
    assign('ACCOUNTANT', { permissions: [] })
    const r = await resolveUserPermissions(BIZ, USER, null)
    expect(screenLevel(r.levels, 'laundry.orders')).toBe(Level.EDIT)
  })

  it('is reach, NOT ownership — owner protections stay with the owner', async () => {
    assign('ACCOUNTANT')
    const r = await resolveUserPermissions(BIZ, USER, null)
    // isOwner false ⇒ staffDeletionRefusal / the deactivate+demote guard do not
    // treat an Accountant as the Business Owner, so they stay manageable staff.
    expect(r.isOwner).toBe(false)
  })

  it('still respects the owner-only reservation', async () => {
    assign('ACCOUNTANT')
    const r = await resolveUserPermissions(BIZ, USER, null)
    expect(screenLevel(r.levels, 'laundry.hardware')).toBe(0)
    expect(fullAccessScreenKeys()).not.toContain('laundry.hardware')
    expect(allScreenKeys()).toContain('laundry.hardware')
  })

  it('a DEACTIVATED Accountant role grants nothing', async () => {
    assign('ACCOUNTANT', { isActive: false })
    const r = await resolveUserPermissions(BIZ, USER, null)
    expect(r.roleCode).toBe('UNASSIGNED')
    expect(r.levels.size).toBe(0)
  })
})

describe('tenant isolation is preserved', () => {
  it('grants nothing for a business the Accountant is not assigned to', async () => {
    assign('ACCOUNTANT', { businessId: BIZ })
    const r = await resolveUserPermissions(OTHER_BIZ, USER, null)
    expect(r.roleCode).toBe('UNASSIGNED')
    expect(r.levels.size).toBe(0)
  })

  it('the assignment lookup is always scoped to the resolved business', async () => {
    assign('ACCOUNTANT')
    await resolveUserPermissions(BIZ, USER, null)
    const where = H.prisma.laundryAccessAssignment.findFirst.mock.calls[0][0].where
    expect(where.businessId).toBe(BIZ)
    expect(where.userId).toBe(USER)
    expect(where.active).toBe(true)
  })

  it('full access does not leak across tenants for the same user', async () => {
    assign('ACCOUNTANT', { businessId: BIZ })
    expect(screenLevel((await resolveUserPermissions(BIZ, USER, null)).levels, 'laundry.orders')).toBe(Level.EDIT)
    expect(screenLevel((await resolveUserPermissions(OTHER_BIZ, USER, null)).levels, 'laundry.orders')).toBe(0)
  })
})

describe('existing roles are unchanged', () => {
  it('the Business Owner still resolves as owner', async () => {
    assign('BUSINESS_OWNER', { isOwner: true })
    const r = await resolveUserPermissions(BIZ, USER, null)
    expect(r.isOwner).toBe(true)
  })

  it('a business-role owner still short-circuits before any assignment', async () => {
    assign('ACCOUNTANT')
    const r = await resolveUserPermissions(BIZ, USER, 'LAUNDRY_OWNER')
    expect(r.isOwner).toBe(true)
    expect(r.roleCode).toBe('BUSINESS_OWNER')
  })

  it('a non-full-access role still gets only what it stores', async () => {
    assign('COUNTER_EXECUTIVE', {
      permissions: [{ permKey: 'laundry.orders.view', level: Level.VIEW, effect: 'ALLOW' }],
    })
    const r = await resolveUserPermissions(BIZ, USER, null)
    expect(screenLevel(r.levels, 'laundry.orders')).toBe(Level.VIEW)
    expect(screenLevel(r.levels, 'laundry.pricing')).toBe(0)
    expect(r.isOwner).toBe(false)
  })

  it('an unassigned user still gets nothing', async () => {
    const r = await resolveUserPermissions(BIZ, USER, null)
    expect(r.roleCode).toBe('UNASSIGNED')
  })
})
