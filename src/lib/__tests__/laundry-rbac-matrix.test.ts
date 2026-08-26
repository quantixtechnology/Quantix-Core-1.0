import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { SYSTEM_ROLES } from '@/lib/laundry-rbac-catalog'
import {
  Level, allScreenKeys, isValidScreenKey, permKeyToScreenLevel,
  actionToLevel, isScreenAccessible,
} from '@/lib/laundry-rbac-registry'
import { defaultNavigationConfig, SCREEN_PAGE_MAP } from '@/lib/laundry-nav-config'
import { ROLE_ADMIN_SCREEN, ROLE_READ_SCREENS } from '@/lib/laundry-rbac-screens'

// ============================================================================
// THE RULE: what the sidebar offers, the API must accept — and nothing more.
//
// Every failure reported came from the two halves disagreeing:
//
//   • Roles & Permissions rendered an EMPTY matrix for everyone, the Business
//     Owner included, because the screen fetched /rbac/catalog without the
//     businessId its tenant guard requires and quietly kept the empty result.
//   • The Processing Center Dashboard answered 403 to Processing Manager and
//     Processing Staff because it asked for laundry.orders — a screen neither
//     role is granted — while the navigation that reaches it is laundry.dashboard.
//   • Three financial endpoints, and the RBAC sync endpoint, guarded on screen
//     keys that do not exist in the registry, so they denied every role.
//   • Fourteen master-data WRITE endpoints resolved to VIEW, so a Viewer could
//     rewrite Services, Garments and Pricing.
//
// Delivery Executive is out of scope: separate PWA, separate session model.
// ============================================================================

const ROOT = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')
const api = (p: string) => read(`src/app/api/${p}/route.ts`)

const EXCLUDED = 'DELIVERY_EXECUTIVE'
const ROLES = SYSTEM_ROLES.filter((r) => r.code !== EXCLUDED)
const levelsOf = (code: string): Record<string, number> => {
  const def = SYSTEM_ROLES.find((r) => r.code === code)!
  const m: Record<string, number> = {}
  for (const s of def.screens()) m[s.screenKey] = Math.max(m[s.screenKey] ?? 0, s.level)
  return m
}
const isOwnerRole = (code: string) => !!SYSTEM_ROLES.find((r) => r.code === code)?.isOwner
const holds = (code: string, key: string, lvl = Level.VIEW) =>
  isOwnerRole(code) || (levelsOf(code)[key] ?? 0) >= lvl

/**
 * Every screen key a route's guards require, read from the source.
 *
 * `keys` is a list because an any-of guard is satisfied by any one of them.
 * The shared constants are expanded so the check follows the real guard rather
 * than the name it is written under.
 */
const CONSTANTS: Record<string, string[]> = {
  ROLE_READ_SCREENS: ROLE_READ_SCREENS,
  ROLE_ADMIN_SCREEN: [ROLE_ADMIN_SCREEN],
}
function guardKeys(routePath: string): { keys: string[]; level: number }[] {
  const s = api(routePath)
  const out: { keys: string[]; level: number }[] = []
  for (const m of s.matchAll(/requireLaundry(?:Any)?Level\([^,]+,[^,]+,\s*(?:["'`]([^"'`$]+)["'`]|(\w+))\s*,\s*Level\.(\w+)/g)) {
    const keys = m[1] ? [m[1]] : (CONSTANTS[m[2]] ?? [m[2]])
    out.push({ keys, level: Level[m[3] as keyof typeof Level] as number })
  }
  for (const m of s.matchAll(/requireLaundryPermission\([^,]+,[^,]+,\s*["']([^"'$]+)["']/g)) {
    const mapped = permKeyToScreenLevel(m[1])
    out.push(mapped ? { keys: [mapped.screenKey], level: mapped.level } : { keys: [m[1]], level: Level.VIEW })
  }
  return out
}

// ── A. The registry is the only key space ─────────────────────────────────
describe('A. every guard names a REGISTERED screen', () => {
  const walk = (d: string): string[] =>
    readdirSync(join(ROOT, d)).flatMap((n) => {
      const p = `${d}/${n}`
      return statSync(join(ROOT, p)).isDirectory() ? walk(p) : n === 'route.ts' ? [p] : []
    })

  it('no laundry API guards on a key that does not exist', () => {
    // An unregistered key can never be granted, so the endpoint denies every
    // role and only the owner's blanket flag gets through. laundry.rbac and
    // laundry.payment_collection were exactly that.
    const bad: string[] = []
    for (const f of walk('src/app/api/laundry')) {
      const s = read(f)
      for (const m of s.matchAll(/requireLaundryLevel\([^,]+,[^,]+,\s*["'`]([^"'`$]+)["'`]/g)) {
        if (!isValidScreenKey(m[1]) && !m[1].startsWith('ROLE_')) bad.push(`${f}: ${m[1]}`)
      }
      for (const m of s.matchAll(/requireLaundryPermission\([^,]+,[^,]+,\s*["']([^"'$]+)["']/g)) {
        if (!permKeyToScreenLevel(m[1]) && !isValidScreenKey(m[1])) bad.push(`${f}: ${m[1]}`)
      }
    }
    expect(bad).toEqual([])
  })

  it('a WRITE action never silently resolves to read-only', () => {
    // The compound names are the trap: actionToLevel falls back to VIEW for
    // anything it does not recognise, which is right for a read and disarms a
    // write. These four guard create/update/delete endpoints.
    expect(actionToLevel('edit_pricing')).toBe(Level.EDIT)
    expect(actionToLevel('delete_rules')).toBe(Level.EDIT)
    expect(actionToLevel('edit')).toBe(Level.EDIT)
    expect(actionToLevel('delete')).toBe(Level.EDIT)
  })

  it('a Viewer can no longer rewrite the tenant masters', () => {
    for (const r of ['laundry/services', 'laundry/categories', 'laundry/garments', 'laundry/pricing']) {
      const writes = guardKeys(r).filter((g) => g.keys.includes('laundry.pricing'))
      expect(writes.some((g) => g.level >= Level.EDIT)).toBe(true)
    }
    expect(holds('VIEWER', 'laundry.pricing', Level.EDIT)).toBe(false)
    // REVERSED: Accountant is now a FULL-ACCESS role (FULL_ACCESS_ROLE_CODES).
    expect(holds('ACCOUNTANT', 'laundry.pricing', Level.EDIT)).toBe(true)
    expect(holds('BUSINESS_OWNER', 'laundry.pricing', Level.EDIT)).toBe(true)
  })
})

// ── B. Navigation ⇔ API, per role ─────────────────────────────────────────
/**
 * The screen a nav item leads to, and the endpoint that screen cannot render
 * without. If a role can see the item, it must satisfy that endpoint's guard.
 */
const NAV_TO_API: { screenKey: string; route: string; note: string }[] = [
  { screenKey: 'laundry.dashboard', route: 'laundry/orders/stats', note: 'Store dashboard' },
  { screenKey: 'laundry.dashboard', route: 'laundry/processing/dashboard', note: 'Processing Center dashboard' },
  { screenKey: 'laundry.orders', route: 'laundry/orders', note: 'Orders list' },
  { screenKey: 'laundry.customers', route: 'laundry/customers', note: 'Customers' },
  { screenKey: 'laundry.subscriptions', route: 'laundry/subscriptions', note: 'Subscriptions' },
  { screenKey: 'laundry.staff', route: 'laundry/staff', note: 'Staff' },
  { screenKey: 'laundry.roles', route: 'laundry/rbac/roles', note: 'Roles & Permissions' },
  { screenKey: 'store_ops.payment_collection', route: 'laundry/payments-ledger', note: 'Payments & Ledger' },
  { screenKey: 'processing.sorting', route: 'laundry/processing/sorting', note: 'Sorting workstation' },
  { screenKey: 'processing.transit', route: 'laundry/processing/transit', note: 'Transit workstation' },
]

describe('B. if the navigation offers it, the API accepts it', () => {
  for (const role of ROLES) {
    for (const n of NAV_TO_API) {
      it(`${role.code} · ${n.note}`, () => {
        const lv = levelsOf(role.code)
        if (!isScreenAccessible(lv, isOwnerRole(role.code), n.screenKey)) return // not offered — nothing to agree about
        // Only the VIEW-level guards decide whether the SCREEN loads. A
        // CREATE/EDIT guard on the same route is an action inside the screen —
        // a Viewer opening Sorting and being unable to act is correct.
        const need = guardKeys(n.route).filter((g) => g.level === Level.VIEW)
        if (!need.length) return // an action-only endpoint: no screen to load
        const satisfied = need.some((g) => g.keys.some((k) => holds(role.code, k, g.level)))
        expect(satisfied, `${role.code} sees ${n.note} but ${n.route} requires ${JSON.stringify(need)}`).toBe(true)
      })
    }
  }
})

// ── C. The two reported failures ──────────────────────────────────────────
describe('C. Processing Center dashboard', () => {
  it('is guarded by the screen that navigates to it, not by Orders', () => {
    const keys = guardKeys('laundry/processing/dashboard').flatMap((g) => g.keys)
    expect(keys).toContain('laundry.dashboard')
    expect(keys).not.toContain('laundry.orders')
  })

  it('loads for every role that can reach it', () => {
    // Processing Manager and Processing Staff hold laundry.dashboard and a
    // processing screen — which is exactly what routes them to this dashboard.
    for (const code of ['PROCESSING_MANAGER', 'PROCESSING_STAFF', 'STORE_MANAGER', 'VIEWER', 'BUSINESS_OWNER']) {
      expect(holds(code, 'laundry.dashboard'), code).toBe(true)
    }
  })

  it('the sibling Store dashboard is guarded the same way', () => {
    expect(guardKeys('laundry/orders/stats').flatMap((g) => g.keys)).toContain('laundry.dashboard')
  })

  it('neither processing role holds laundry.orders — which is why it failed', () => {
    expect(holds('PROCESSING_STAFF', 'laundry.orders')).toBe(false)
    expect(holds('PROCESSING_MANAGER', 'laundry.orders')).toBe(false)
  })
})

describe('C. Roles & Permissions', () => {
  it('the screen requests the catalog WITH its businessId', () => {
    // Without it the tenant guard answers 400 and the matrix renders empty.
    const ui = read('src/components/laundry/views/laundry-roles-permissions.tsx')
    expect(ui).toContain('/api/laundry/rbac/catalog?businessId=${businessId}')
    expect(ui).not.toContain('fetch(`/api/laundry/rbac/catalog`)')
  })

  it('an unreadable catalog is surfaced, never rendered as "no screens"', () => {
    const ui = read('src/components/laundry/views/laundry-roles-permissions.tsx')
    expect(ui).toContain('Could not load the permission catalog.')
  })

  it('role administration is governed by laundry.roles — the key the sidebar uses', () => {
    expect(ROLE_ADMIN_SCREEN).toBe('laundry.roles')
    for (const r of ['laundry/rbac/roles', 'laundry/rbac/roles/[id]/permissions', 'laundry/rbac/seed', 'laundry/rbac/sync']) {
      expect(api(r), r).toContain('ROLE_ADMIN_SCREEN')
    }
  })

  it('reading roles still works from the Staff screen', () => {
    // Staff fills its "assign a role" dropdown from the same list.
    expect(ROLE_READ_SCREENS).toEqual(['laundry.roles', 'laundry.staff'])
    expect(api('laundry/rbac/roles')).toContain('ROLE_READ_SCREENS')
  })

  it('the Business Owner reaches every part of it', () => {
    for (const k of ['laundry.roles', 'laundry.staff', 'laundry.settings', 'laundry.stores', 'laundry.navigation']) {
      expect(holds('BUSINESS_OWNER', k, Level.EDIT), k).toBe(true)
    }
  })

  it('assigning a role is Staff administration and stays there', () => {
    expect(api('laundry/rbac/assignments')).toContain('"laundry.staff"')
  })
})

// ── D. Role definitions ───────────────────────────────────────────────────
describe('D. every role gets what its definition says', () => {
  it('the Business Owner is the owner role and holds every screen', () => {
    const owner = SYSTEM_ROLES.find((r) => r.code === 'BUSINESS_OWNER')!
    expect(owner.isOwner).toBe(true)
    expect(new Set(owner.screens().map((s) => s.screenKey))).toEqual(new Set(allScreenKeys()))
  })

  it('Processing Manager covers the whole Processing Center', () => {
    const lv = levelsOf('PROCESSING_MANAGER')
    for (const k of allScreenKeys().filter((k) => k.startsWith('processing.'))) {
      expect(lv[k] ?? 0, k).toBeGreaterThanOrEqual(Level.CREATE)
    }
    expect(lv['laundry.dashboard']).toBeGreaterThanOrEqual(Level.VIEW)
  })

  it('Processing Staff works the workstations and nothing else', () => {
    const lv = levelsOf('PROCESSING_STAFF')
    for (const k of ['processing.console_receive', 'processing.audit_barcode', 'processing.washing',
                     'processing.dry_cleaning', 'processing.quality_check', 'processing.sorting',
                     'processing.ironing', 'processing.folding', 'processing.transit']) {
      expect(lv[k] ?? 0, k).toBeGreaterThanOrEqual(Level.CREATE)
    }
    // No store, CRM or administration.
    for (const k of ['laundry.staff', 'laundry.roles', 'laundry.settings', 'crm.leads',
                     'store_ops.store_audit', 'laundry.orders']) {
      expect(lv[k] ?? 0, k).toBe(0)
    }
  })

  it('Store Manager runs the store, not the platform', () => {
    const lv = levelsOf('STORE_MANAGER')
    for (const k of allScreenKeys().filter((k) => k.startsWith('store_ops.'))) {
      expect(lv[k] ?? 0, k).toBeGreaterThanOrEqual(Level.CREATE)
    }
    expect(lv['laundry.settings'] ?? 0).toBe(0)
    expect(lv['laundry.hardware'] ?? 0).toBe(0)
  })

  it('Viewer is read-only everywhere it can see', () => {
    const lv = levelsOf('VIEWER')
    for (const [k, l] of Object.entries(lv)) expect(l, k).toBe(Level.VIEW)
    // …and never reaches terminal administration.
    expect(lv['laundry.hardware'] ?? 0).toBe(0)
  })

  it('CRM roles stay inside CRM', () => {
    for (const code of ['CRM_MANAGER', 'CRM_EXECUTIVE']) {
      const lv = levelsOf(code)
      for (const k of Object.keys(lv)) {
        expect(k === 'laundry.dashboard' || k.startsWith('crm.'), `${code}:${k}`).toBe(true)
      }
    }
  })

  // REVERSED: Accountant used to read the money and edit only reports. It is
  // now a FULL-ACCESS role — every screen at EDIT except the owner-only
  // reservations, so no future screen needs a per-permission grant.
  it('Accountant holds every non-owner-only screen at EDIT', () => {
    const lv = levelsOf('ACCOUNTANT')
    expect(lv['store_ops.payment_collection']).toBe(Level.EDIT)
    expect(lv['laundry.reports']).toBe(Level.EDIT)
    expect(lv['laundry.orders']).toBe(Level.EDIT)          // the reported bug
    for (const k of allScreenKeys().filter((k) => k.startsWith('processing.'))) expect(lv[k], k).toBe(Level.EDIT)
    // …but the owner-only reservation still holds.
    expect(lv['laundry.hardware'] ?? 0).toBe(0)
  })

  it('every role that has any screen can land somewhere', () => {
    for (const role of ROLES) {
      const lv = levelsOf(role.code)
      const landable = Object.keys(lv).some((k) => SCREEN_PAGE_MAP[k])
      expect(isOwnerRole(role.code) || landable, role.code).toBe(true)
    }
  })

  it('every screen a role is granted is a registered screen', () => {
    for (const role of ROLES) {
      for (const k of Object.keys(levelsOf(role.code))) expect(isValidScreenKey(k), `${role.code}:${k}`).toBe(true)
    }
  })

  it('every navigable screen is reachable by at least the owner', () => {
    for (const g of defaultNavigationConfig()) {
      for (const item of g.items) {
        expect(isValidScreenKey(item.screenKey), item.screenKey).toBe(true)
        expect(isScreenAccessible(levelsOf('BUSINESS_OWNER'), true, item.screenKey)).toBe(true)
      }
    }
  })
})

// ── E. Assignment → effective access ──────────────────────────────────────
const mocks = vi.hoisted(() => ({
  assignFindFirst: vi.fn(),
  roleCount: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    laundryAccessAssignment: { findFirst: mocks.assignFindFirst },
    laundryAccessRole: { count: mocks.roleCount, findFirst: vi.fn(), create: vi.fn() },
    laundryAccessPermission: { createMany: vi.fn(), update: vi.fn() },
    laundryAccessAudit: { create: vi.fn() },
  },
}))
vi.mock('@/lib/laundry-business', () => ({ resolveLaundryBusiness: vi.fn() }))
vi.mock('@/lib/laundry-auth', () => ({ getLaundryAuthContext: vi.fn() }))

import { resolveUserPermissions, isOwnerRole as isOwnerBusinessRole } from '@/lib/laundry-rbac'

const roleRow = (code: string, perms: { permKey: string; level: number }[]) => ({
  isActive: true, isOwner: false, code, name: code,
  permissions: perms.map((p) => ({ ...p, effect: 'ALLOW' })),
})

describe('E. a user gets exactly their assigned role', () => {
  beforeEach(() => vi.clearAllMocks())

  it('the assigned role decides, and nothing else', async () => {
    mocks.assignFindFirst.mockResolvedValue({
      role: roleRow('PROCESSING_STAFF', [{ permKey: 'processing.washing', level: Level.CREATE }]),
    })
    const r = await resolveUserPermissions('biz', 'u1', 'STAFF')
    expect(r.roleCode).toBe('PROCESSING_STAFF')
    expect(r.levels.get('processing.washing')).toBe(Level.CREATE)
    expect(r.levels.get('laundry.orders') ?? 0).toBe(0)
    expect(r.isOwner).toBe(false)
  })

  it('changing the role changes the access on the very next request', async () => {
    mocks.assignFindFirst.mockResolvedValueOnce({
      role: roleRow('PROCESSING_STAFF', [{ permKey: 'processing.washing', level: Level.CREATE }]),
    })
    expect((await resolveUserPermissions('biz', 'u1', 'STAFF')).roleCode).toBe('PROCESSING_STAFF')
    mocks.assignFindFirst.mockResolvedValueOnce({
      role: roleRow('PROCESSING_MANAGER', [{ permKey: 'processing.sorting', level: Level.CREATE }]),
    })
    const after = await resolveUserPermissions('biz', 'u1', 'STAFF')
    expect(after.roleCode).toBe('PROCESSING_MANAGER')
    expect(after.levels.get('processing.sorting')).toBe(Level.CREATE)
  })

  it('a deactivated role leaves NO access', async () => {
    mocks.assignFindFirst.mockResolvedValue({ role: { ...roleRow('X', []), isActive: false } })
    const r = await resolveUserPermissions('biz', 'u1', 'STAFF')
    expect(r.roleCode).toBe('UNASSIGNED')
    expect(r.permissions.size).toBe(0)
  })

  it('no assignment means no screens — BusinessUser.role never grants access', async () => {
    mocks.assignFindFirst.mockResolvedValue(null)
    const r = await resolveUserPermissions('biz', 'u1', 'MANAGER')
    expect(r.permissions.size).toBe(0)
  })

  it('the tenant owner resolves to the Business Owner role, not to a copy of it', async () => {
    for (const role of ['CLIENT_OWNER', 'LAUNDRY_OWNER']) {
      const r = await resolveUserPermissions('biz', 'u1', role)
      expect(r.isOwner).toBe(true)
      expect(r.roleCode).toBe('BUSINESS_OWNER')
      expect(r.permissions.size).toBe(allScreenKeys().length)
      expect(mocks.assignFindFirst).not.toHaveBeenCalled()
    }
    expect(isOwnerBusinessRole('COUNTER_EXECUTIVE')).toBe(false)
  })

  it('two active assignments resolve deterministically, never at random', async () => {
    // Otherwise the same person is Processing Staff on one request and Store
    // Manager on the next — the "second hidden permission list".
    mocks.assignFindFirst.mockResolvedValue({ role: roleRow('STORE_MANAGER', []) })
    await resolveUserPermissions('biz', 'u1', 'STAFF')
    const arg = mocks.assignFindFirst.mock.calls[0][0]
    expect(arg.orderBy).toBeTruthy()
    expect(arg.where).toMatchObject({ businessId: 'biz', userId: 'u1', active: true })
  })

  it('the query is always scoped to ONE business — a role is not portable', async () => {
    mocks.assignFindFirst.mockResolvedValue(null)
    await resolveUserPermissions('business-A', 'u1', 'STAFF')
    expect(mocks.assignFindFirst.mock.calls[0][0].where.businessId).toBe('business-A')
  })
})

// ── F. Nothing new was built ──────────────────────────────────────────────
describe('F. no second RBAC system', () => {
  it('no new table', () => {
    const schema = read('prisma/schema.prisma')
    for (const m of ['model LaundryScreenPermission', 'model RbacOverride', 'model LaundryRoleScreen']) {
      expect(schema).not.toContain(m)
    }
  })

  it('no hardcoded user, email or role-name exception', () => {
    for (const f of ['src/lib/laundry-rbac.ts', 'src/lib/laundry-rbac-screens.ts',
                     'src/app/api/laundry/processing/dashboard/route.ts']) {
      const s = read(f)
      expect(s).not.toMatch(/@gmail\.com|@quantixtechnology/)
      expect(s).not.toMatch(/userId === ["']c[a-z0-9]{20,}/)
    }
  })

  it('the reconcile is additive and leaves custom roles alone', () => {
    const s = read('src/lib/laundry-rbac.ts')
    expect(s).toContain('isSystem: true')
    // It adds and raises; it never deletes a permission row.
    const fn = s.slice(s.indexOf('export async function reconcileSystemRoles'))
    expect(fn).not.toContain('deleteMany')
    expect(fn).not.toContain('delete(')
  })

  it('the guard helpers still route through requireLaundryLevel', () => {
    const s = read('src/lib/laundry-rbac.ts')
    const start = s.indexOf('export async function requireLaundryAnyLevel')
    const any = s.slice(start, s.indexOf('\n}', start))
    expect(any).toContain('requireLaundryLevel(request, businessIdInput, key, requiredLevel)')
    expect(any).not.toContain('prisma.')
  })
})
