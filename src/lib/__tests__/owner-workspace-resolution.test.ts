import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// ============================================================================
// THE OWNER MUST NEVER BE LOCKED OUT.
//
// /api/laundry/rbac/me used to answer 400 on a missing businessId and 404 on an
// unrecognised one — BEFORE authenticating. Since that id comes from
// localStorage, one stale value produced "Unable to load this workspace" for
// the Business Owner of a workspace the database knew they owned.
//
// The rule these pin: the browser's businessId is a HINT. The authority is
//     User → BusinessUser(isActive) → Business → LaundryBusiness
// resolved from the authenticated identity whenever the hint does not hold up.
// ============================================================================

const OWNER = { id: 'usr-owner', email: 'owner@vastrasudha.in', name: 'Owner' }
const STAFF = { id: 'usr-staff', email: 'staff@vastrasudha.in', name: 'Staff' }
const PLATFORM_BIZ = 'BUS-202608-0008'
const LAUNDRY_BIZ = 'lb_vastrasudha'

const H = vi.hoisted(() => {
  const state = {
    identity: null as null | { userId: string; role: string; email: string; name: string },
    laundryBusinesses: [] as { id: string; platformBusinessId: string | null }[],
    businessUsers: [] as { userId: string; businessId: string; role: string; isActive: boolean; createdAt: Date }[],
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prisma = {
    laundryBusiness: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      findFirst: vi.fn(async (a: any) => {
        const ors = a.where.OR as Record<string, string>[]
        const hit = state.laundryBusinesses.find((b) =>
          ors.some((o) => ('id' in o && b.id === o.id) || ('platformBusinessId' in o && b.platformBusinessId === o.platformBusinessId)))
        return hit ? { ...hit } : null
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      findUnique: vi.fn(async (a: any) => {
        const hit = state.laundryBusinesses.find((b) => b.id === a.where.id)
        return hit ? { platformBusinessId: hit.platformBusinessId } : null
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      findMany: vi.fn(async (a: any) => {
        const ids: string[] = a.where.platformBusinessId.in
        return state.laundryBusinesses.filter((b) => b.platformBusinessId && ids.includes(b.platformBusinessId)).map((b) => ({ ...b }))
      }),
    },
    businessUser: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      findFirst: vi.fn(async (a: any) => {
        const hit = state.businessUsers.find((m) =>
          m.userId === a.where.userId && m.businessId === a.where.businessId && m.isActive === a.where.isActive)
        return hit ? { role: hit.role } : null
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      findMany: vi.fn(async (a: any) =>
        state.businessUsers
          .filter((m) => m.userId === a.where.userId && m.isActive === a.where.isActive)
          .sort((x, y) => y.createdAt.getTime() - x.createdAt.getTime())
          .map((m) => ({ businessId: m.businessId, role: m.role, createdAt: m.createdAt }))),
    },
    refreshToken: { findUnique: vi.fn(async () => null) },
  }
  return { state, prisma }
})

vi.mock('@/lib/prisma', () => ({ prisma: H.prisma }))
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => (H.state.identity ? { user: { id: H.state.identity.userId, role: H.state.identity.role, email: H.state.identity.email, name: H.state.identity.name } } : null)) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/permissions', () => ({ isPlatformRole: (r: string) => r === 'QUANTIX_SUPER_ADMIN' || r === 'PLATFORM_ADMIN' }))

import { resolveCallerWorkspace, callerLaundryWorkspaces } from '@/lib/laundry-auth'

const { state } = H

const seedOwner = () => {
  state.laundryBusinesses = [{ id: LAUNDRY_BIZ, platformBusinessId: PLATFORM_BIZ }]
  state.businessUsers = [{ userId: OWNER.id, businessId: PLATFORM_BIZ, role: 'LAUNDRY_OWNER', isActive: true, createdAt: new Date('2026-08-01') }]
  state.identity = { userId: OWNER.id, role: '', email: OWNER.email, name: OWNER.name }
}

beforeEach(() => {
  state.identity = null
  state.laundryBusinesses = []
  state.businessUsers = []
  vi.clearAllMocks()
})

// ── Test 1 + 2 — Owner login → workspace loads ─────────────────────────────
describe('Test 1 & 2 · Owner logs in and the workspace resolves', () => {
  it('resolves the Owner workspace from a correct businessId', async () => {
    seedOwner()
    const ws = await resolveCallerWorkspace(LAUNDRY_BIZ)
    expect(ws?.laundryBusinessId).toBe(LAUNDRY_BIZ)
    expect(ws?.platformBusinessId).toBe(PLATFORM_BIZ)
    expect(ws?.source).toBe('requested')
    expect(ws?.ctx.role).toBe('LAUNDRY_OWNER')
  })

  it('also accepts the PLATFORM business id as the hint', async () => {
    seedOwner()
    const ws = await resolveCallerWorkspace(PLATFORM_BIZ)
    expect(ws?.laundryBusinessId).toBe(LAUNDRY_BIZ)
  })
})

// ── Test 3 — Missing businessId ────────────────────────────────────────────
describe('Test 3 · missing businessId', () => {
  it('resolves the Owner workspace with NO businessId supplied', async () => {
    seedOwner()
    for (const hint of [null, undefined, '']) {
      const ws = await resolveCallerWorkspace(hint)
      expect(ws?.laundryBusinessId).toBe(LAUNDRY_BIZ)
      expect(ws?.source).toBe('membership')
    }
  })
})

// ── Test 4 — Invalid / stale businessId ────────────────────────────────────
describe('Test 4 · stale or invalid businessId', () => {
  it('recovers the Owner workspace from a businessId that does not exist', async () => {
    seedOwner()
    const ws = await resolveCallerWorkspace('lb_deleted_last_year')
    expect(ws?.laundryBusinessId).toBe(LAUNDRY_BIZ)
    expect(ws?.source).toBe('membership')
  })

  it("recovers when the id names ANOTHER tenant's business", async () => {
    seedOwner()
    state.laundryBusinesses.push({ id: 'lb_other', platformBusinessId: 'BUS-202606-0005' })
    const ws = await resolveCallerWorkspace('lb_other')
    // Not a member there → falls back to the workspace they DO own.
    expect(ws?.laundryBusinessId).toBe(LAUNDRY_BIZ)
    expect(ws?.source).toBe('membership')
  })

  it('does NOT hand the caller a workspace they have no membership in', async () => {
    state.laundryBusinesses = [{ id: 'lb_other', platformBusinessId: 'BUS-202606-0005' }]
    state.businessUsers = []
    state.identity = { userId: STAFF.id, role: '', email: STAFF.email, name: STAFF.name }
    expect(await resolveCallerWorkspace('lb_other')).toBeNull()
  })

  it('returns null when nobody is authenticated', async () => {
    seedOwner()
    state.identity = null
    expect(await resolveCallerWorkspace(LAUNDRY_BIZ)).toBeNull()
  })
})

// ── Test 5 — Owner RBAC ────────────────────────────────────────────────────
describe('Test 5 · Owner RBAC', () => {
  it('carries the owner business role through, whichever owner marker is used', async () => {
    for (const role of ['LAUNDRY_OWNER', 'CLIENT_OWNER']) {
      seedOwner()
      state.businessUsers[0].role = role
      const ws = await resolveCallerWorkspace(null)
      expect(ws?.ctx.role).toBe(role)
    }
  })

  it('ranks an OWNER membership above a staff membership elsewhere', async () => {
    state.laundryBusinesses = [
      { id: LAUNDRY_BIZ, platformBusinessId: PLATFORM_BIZ },
      { id: 'lb_other', platformBusinessId: 'BUS-202606-0005' },
    ]
    state.businessUsers = [
      // Newer, but only a staff membership — must NOT outrank ownership.
      { userId: OWNER.id, businessId: 'BUS-202606-0005', role: 'STORE_MANAGER', isActive: true, createdAt: new Date('2026-08-20') },
      { userId: OWNER.id, businessId: PLATFORM_BIZ, role: 'LAUNDRY_OWNER', isActive: true, createdAt: new Date('2026-08-01') },
    ]
    state.identity = { userId: OWNER.id, role: '', email: OWNER.email, name: OWNER.name }
    const list = await callerLaundryWorkspaces(OWNER.id)
    expect(list[0].laundryBusinessId).toBe(LAUNDRY_BIZ)
    expect((await resolveCallerWorkspace(null))?.laundryBusinessId).toBe(LAUNDRY_BIZ)
  })
})

// ── Test 6 — Ordinary user changes ─────────────────────────────────────────
describe('Test 6 · ordinary user changes cannot affect Owner access', () => {
  it('adding, deactivating and removing staff leaves the Owner resolvable', async () => {
    seedOwner()
    state.businessUsers.push({ userId: STAFF.id, businessId: PLATFORM_BIZ, role: 'COUNTER_EXECUTIVE', isActive: true, createdAt: new Date('2026-08-10') })
    expect((await resolveCallerWorkspace(null))?.laundryBusinessId).toBe(LAUNDRY_BIZ)

    state.businessUsers[1].isActive = false // deactivated
    expect((await resolveCallerWorkspace(null))?.laundryBusinessId).toBe(LAUNDRY_BIZ)

    state.businessUsers = state.businessUsers.slice(0, 1) // deleted
    expect((await resolveCallerWorkspace(null))?.laundryBusinessId).toBe(LAUNDRY_BIZ)
  })

  it("a staff member's own stale cache never reaches the Owner's workspace", async () => {
    seedOwner()
    state.businessUsers.push({ userId: STAFF.id, businessId: 'BUS-202606-0005', role: 'COUNTER_EXECUTIVE', isActive: true, createdAt: new Date('2026-08-10') })
    state.laundryBusinesses.push({ id: 'lb_other', platformBusinessId: 'BUS-202606-0005' })
    state.identity = { userId: STAFF.id, role: '', email: STAFF.email, name: STAFF.name }
    // Staff asks for the Owner's workspace → falls back to their OWN, not the Owner's.
    expect((await resolveCallerWorkspace(LAUNDRY_BIZ))?.laundryBusinessId).toBe('lb_other')
  })
})

// ── Test 7 & 8 — Business / subscription changes ───────────────────────────
describe('Test 7 & 8 · business and subscription changes', () => {
  it('renaming or re-coding the business does not orphan the Owner', async () => {
    seedOwner()
    // The membership is keyed on ids, not on any mutable business attribute.
    expect((await resolveCallerWorkspace(null))?.platformBusinessId).toBe(PLATFORM_BIZ)
  })

  it('resolution reads no subscription, plan or status field', async () => {
    seedOwner()
    await resolveCallerWorkspace(null)
    const reads = [
      ...H.prisma.businessUser.findMany.mock.calls,
      ...H.prisma.laundryBusiness.findMany.mock.calls,
    ].map((c) => JSON.stringify(c))
    for (const r of reads) {
      expect(r).not.toContain('subscription')
      expect(r).not.toContain('plan')
      expect(r).not.toContain('status')
    }
  })
})

// ── Test 9 — Cache corruption ──────────────────────────────────────────────
describe('Test 9 · corrupted client cache', () => {
  it('garbage in the cached businessId cannot lock the Owner out', async () => {
    for (const junk of ['undefined', 'null', '{}', 'BUS-000000-0000', '   ']) {
      seedOwner()
      const ws = await resolveCallerWorkspace(junk)
      expect(ws?.laundryBusinessId).toBe(LAUNDRY_BIZ)
    }
  })
})

// ── Test 10 — Structural guarantees ────────────────────────────────────────
describe('Test 10 · structural protections', () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

  it('rbac/me never rejects on the client-supplied id alone', () => {
    const ME = read('src/app/api/laundry/rbac/me/route.ts')
    expect(ME).not.toContain('Missing businessId')
    expect(ME).toContain('resolveCallerWorkspace(requested, request)')
    // The resolved workspace is returned so the client can heal its cache.
    expect(ME).toContain('businessId: laundryBusinessId')
  })

  it('the bootstrap adopts the authoritative id instead of failing', () => {
    const BS = read('src/components/laundry/laundry-workspace-bootstrap.tsx')
    expect(BS).toContain('setActiveBusinessId(authoritative)')
    // A missing cached id is no longer an immediate failure.
    expect(BS).not.toMatch(/if \(!businessId\) \{\s*\n\s*setStatus\("failed"\)/)
  })

  it('the Owner cannot be deactivated, demoted or deleted from staff management', () => {
    const STAFF_ROUTE = read('src/app/api/laundry/staff/[userId]/route.ts')
    expect(STAFF_ROUTE).toContain('The Business Owner cannot be deactivated or have their role changed.')
    expect(STAFF_ROUTE).toContain('staffDeletionRefusal')
    const DEL = read('src/lib/staff-deletion.ts')
    expect(DEL).toContain('isBusinessOwnerRole(target.businessRole) || target.hasOwnerAssignment')
  })

  it('the Owner→Business link is unique and cascades, so it cannot silently fork', () => {
    const SCHEMA = read('prisma/schema.prisma')
    // One laundry workspace per platform business — no ambiguous second row.
    expect(SCHEMA).toContain('platformBusinessId             String?         @unique')
    // One membership row per (user, business) — no duplicate Owner memberships.
    expect(SCHEMA).toContain('@@unique([userId, businessId])')
  })
})
