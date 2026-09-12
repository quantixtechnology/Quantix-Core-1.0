import { describe, it, expect } from 'vitest'

// ============================================================================
// CLIENT-RBAC ACTION-PARITY
//
// Before the fix, the client `can()` (use-laundry-permissions.ts) built a Set
// of SCREEN keys only and tested literal Set membership. Action keys like
// "laundry.customers.merge" were never in the Set, so `can("...merge")`
// returned false for every non-owner — the Owner passed solely via the isOwner
// short-circuit.
//
// The fix adds resolveClientLaundryAction(), a pure function that mirrors the
// server's permKeyToScreenLevel path. Action keys resolve through the SAME
// registry the server uses; plain screen keys fall through to the Set.
//
// This test builds a FULL_ACCESS ACCOUNTANT snapshot from the canonical
// fullAccessScreenKeys() — never from a hardcoded screen list — and asserts
// that every action key used in the UI resolves correctly.
// ============================================================================

import { Level } from '@/lib/laundry-rbac-registry'
import { fullAccessScreenKeys } from '@/lib/laundry-rbac-catalog'
import { resolveClientLaundryAction } from '@/hooks/use-laundry-permissions'

type Snapshot = { isOwner: boolean; perms: Set<string>; levels: Record<string, number>; roleCode: string }

// Canonical ACCOUNTANT snapshot — derived from the catalog, identical to what
// /api/laundry/rbac/me returns for a FULL_ACCESS role code.
const ACCOUNTANT_LEVELS: Record<string, number> = {}
const ACCOUNTANT_PERMS = new Set<string>()
for (const sk of fullAccessScreenKeys()) {
  ACCOUNTANT_LEVELS[sk] = Level.EDIT
  ACCOUNTANT_PERMS.add(sk)
}

const ACCOUNTANT_SNAP: Snapshot = {
  isOwner: false,
  perms: ACCOUNTANT_PERMS,
  levels: ACCOUNTANT_LEVELS,
  roleCode: 'ACCOUNTANT',
}

const OWNER_SNAP: Snapshot = {
  isOwner: true,
  perms: new Set(['*']),
  levels: { '*': Level.EDIT },
  roleCode: 'BUSINESS_OWNER',
}

const VIEWER_LEVELS: Record<string, number> = {}
const VIEWER_PERMS = new Set<string>()
for (const sk of fullAccessScreenKeys()) {
  VIEWER_LEVELS[sk] = Level.VIEW
  VIEWER_PERMS.add(sk)
}
const VIEWER_SNAP: Snapshot = {
  isOwner: false,
  perms: VIEWER_PERMS,
  levels: VIEWER_LEVELS,
  roleCode: 'VIEWER',
}

describe('resolveClientLaundryAction — action-key parity', () => {
  it('BUSINESS_OWNER passes for everything (short-circuit unchanged)', () => {
    expect(resolveClientLaundryAction(OWNER_SNAP, true, 'laundry.customers.merge')).toBe(true)
    expect(resolveClientLaundryAction(OWNER_SNAP, true, 'laundry.customers.create')).toBe(true)
    expect(resolveClientLaundryAction(OWNER_SNAP, true, 'laundry.orders.edit')).toBe(true)
    expect(resolveClientLaundryAction(OWNER_SNAP, true, 'laundry.staff.edit')).toBe(true)
    expect(resolveClientLaundryAction(OWNER_SNAP, true, 'laundry.hardware.operate')).toBe(true)
  })

  it('loading (snap === null) returns true (permissive, same as before)', () => {
    expect(resolveClientLaundryAction(null, false, 'laundry.customers.merge')).toBe(true)
  })

  it('ACCOUNTANT FULL_ACCESS: customer action keys resolve through registry', () => {
    expect(resolveClientLaundryAction(ACCOUNTANT_SNAP, false, 'laundry.customers.merge')).toBe(true)
    expect(resolveClientLaundryAction(ACCOUNTANT_SNAP, false, 'laundry.customers.create')).toBe(true)
    expect(resolveClientLaundryAction(ACCOUNTANT_SNAP, false, 'laundry.customers.delete')).toBe(true)
  })

  it('ACCOUNTANT FULL_ACCESS: staff action keys resolve through registry', () => {
    expect(resolveClientLaundryAction(ACCOUNTANT_SNAP, false, 'laundry.staff.edit')).toBe(true)
    expect(resolveClientLaundryAction(ACCOUNTANT_SNAP, false, 'laundry.staff.create')).toBe(true)
    expect(resolveClientLaundryAction(ACCOUNTANT_SNAP, false, 'laundry.staff.assign_role')).toBe(true)
  })

  it('ACCOUNTANT FULL_ACCESS: orders action keys resolve through registry', () => {
    expect(resolveClientLaundryAction(ACCOUNTANT_SNAP, false, 'laundry.orders.edit')).toBe(true)
    expect(resolveClientLaundryAction(ACCOUNTANT_SNAP, false, 'laundry.orders.create')).toBe(true)
  })

  it('ACCOUNTANT FULL_ACCESS: non-owner screen key still resolves via Set', () => {
    expect(resolveClientLaundryAction(ACCOUNTANT_SNAP, false, 'laundry.customers')).toBe(true)
    expect(resolveClientLaundryAction(ACCOUNTANT_SNAP, false, 'laundry.orders')).toBe(true)
    expect(resolveClientLaundryAction(ACCOUNTANT_SNAP, false, 'laundry.staff')).toBe(true)
  })

  it('VIEWER: action keys requiring EDIT/CREATE are correctly denied', () => {
    // VIEWER holds screens at VIEW only — merge (EDIT) must be false
    expect(resolveClientLaundryAction(VIEWER_SNAP, false, 'laundry.customers.merge')).toBe(false)
    expect(resolveClientLaundryAction(VIEWER_SNAP, false, 'laundry.customers.create')).toBe(false)
    expect(resolveClientLaundryAction(VIEWER_SNAP, false, 'laundry.orders.edit')).toBe(false)
    // but screen key is still visible (VIEW >= VIEW)
    expect(resolveClientLaundryAction(VIEWER_SNAP, false, 'laundry.customers')).toBe(true)
  })

  it('ACCOUNTANT FULL_ACCESS: owner-only screen remains unreachable (laundry.hardware)', () => {
    // ACCOUNTANT is excluded from laundry.hardware by fullAccessScreenKeys()
    expect(resolveClientLaundryAction(ACCOUNTANT_SNAP, false, 'laundry.hardware')).toBe(false)
  })

  it('owner-only short-circuit: isOwner=true bypasses all resolution', () => {
    expect(resolveClientLaundryAction(null, true, 'anything')).toBe(true)
  })
})
