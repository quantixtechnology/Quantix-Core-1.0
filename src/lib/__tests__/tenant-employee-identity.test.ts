import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { deriveTenantPrefix } from '@/lib/tenant-identity'

// ============================================================================
// Sequences, reconciliation, and the thing this feature exists for: two tenants
// sharing laundry.quantixtechnology.in, both with employee number 001, both
// with the password "Password@", never reaching each other's account.
// ============================================================================

const ROOT = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')
const codeOnly = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

const CODE_A = 'BUS-202606-0005'
const CODE_B = 'BUS-202606-0012'
const BIZ_A = 'biz_a'
const BIZ_B = 'biz_b'

// ─── An in-memory Prisma with the semantics the real code relies on ─────────
type Row = Record<string, unknown>
const db = {
  business: [] as Row[],
  tenantIdentity: [] as Row[],
  tenantEmployeeSequence: [] as Row[],
  businessUser: [] as Row[],
  laundryDeliveryExecutive: [] as Row[],
  laundryAccessAssignment: [] as Row[],
}
let ids = 0
const nid = () => `r${++ids}`
const match = (row: Row, where: Row): boolean =>
  Object.entries(where).every(([k, v]) => {
    if (v && typeof v === 'object' && 'not' in (v as Row)) return row[k] !== (v as Row).not
    if (v && typeof v === 'object' && 'isOwner' in (v as Row)) return true
    return row[k] === v
  })

vi.mock('@/lib/prisma', () => {
  const table = (name: keyof typeof db) => ({
    findUnique: vi.fn(async ({ where }: never) => {
      const w = where as Row
      // compound key support: { businessId_namespace: { … } }
      const compound = w.businessId_namespace as Row | undefined
      const q = compound ?? w
      return db[name].find((r) => match(r, q)) ?? null
    }),
    findFirst: vi.fn(async ({ where }: never) => db[name].find((r) => match(r, where as Row)) ?? null),
    findMany: vi.fn(async (args?: never) => {
      const w = (args as { where?: Row } | undefined)?.where
      return w ? db[name].filter((r) => match(r, w)) : [...db[name]]
    }),
    create: vi.fn(async ({ data }: never) => {
      const d: Row = { id: nid(), ...(data as Row) }
      // unique indexes the real schema declares
      if (name === 'tenantIdentity' && db[name].some((r) => r.prefix === d.prefix || r.businessId === d.businessId)) {
        throw new Error('Unique constraint failed')
      }
      db[name].push(d)
      return d
    }),
    update: vi.fn(async ({ where, data }: never) => {
      const r = db[name].find((x) => match(x, where as Row))
      if (!r) throw new Error('not found')
      Object.assign(r, data as Row)
      return r
    }),
    // Atomic in one statement, exactly like the real upsert-increment.
    upsert: vi.fn(async ({ where, create, update }: never) => {
      const w = (where as Row).businessId_namespace as Row
      const found = db[name].find((r) => match(r, w))
      // Return a SNAPSHOT, like the database does. Handing back the live row
      // would let a later increment change what an earlier caller reads.
      if (!found) { const d: Row = { id: nid(), ...(create as Row) }; db[name].push(d); return { ...d } }
      const inc = (update as Row).next as { increment: number }
      found.next = (found.next as number) + inc.increment
      return { ...found }
    }),
  })
  return {
    prisma: {
      business: table('business'),
      tenantIdentity: table('tenantIdentity'),
      tenantEmployeeSequence: table('tenantEmployeeSequence'),
      businessUser: table('businessUser'),
      laundryDeliveryExecutive: table('laundryDeliveryExecutive'),
      laundryAccessAssignment: table('laundryAccessAssignment'),
    },
  }
})

const reset = () => {
  for (const k of Object.keys(db) as (keyof typeof db)[]) db[k].length = 0
  db.business.push({ id: BIZ_A, businessCode: CODE_A, name: 'VASTRASUDHA' })
  db.business.push({ id: BIZ_B, businessCode: CODE_B, name: 'Tenant B' })
}

describe('the persisted prefix', () => {
  beforeEach(reset)

  it('is created once and then returned, never recomputed', async () => {
    const { getTenantIdentityPrefix } = await import('@/lib/tenant-identity-server')
    const first = await getTenantIdentityPrefix(BIZ_A)
    expect(first).toBe('8T5')
    for (let i = 0; i < 5; i++) expect(await getTenantIdentityPrefix(BIZ_A)).toBe(first)
    expect(db.tenantIdentity.filter((r) => r.businessId === BIZ_A)).toHaveLength(1)
  })

  it('survives a Business Code edit — §13', async () => {
    const { getTenantIdentityPrefix } = await import('@/lib/tenant-identity-server')
    const before = await getTenantIdentityPrefix(BIZ_A)
    db.business.find((b) => b.id === BIZ_A)!.businessCode = 'BUS-209912-9999'
    expect(await getTenantIdentityPrefix(BIZ_A)).toBe(before)
  })

  it('survives a rename', async () => {
    const { getTenantIdentityPrefix } = await import('@/lib/tenant-identity-server')
    const before = await getTenantIdentityPrefix(BIZ_A)
    db.business.find((b) => b.id === BIZ_A)!.name = 'Something Else Entirely'
    expect(await getTenantIdentityPrefix(BIZ_A)).toBe(before)
  })

  it('gives two businesses two prefixes', async () => {
    const { getTenantIdentityPrefix } = await import('@/lib/tenant-identity-server')
    expect(await getTenantIdentityPrefix(BIZ_A)).not.toBe(await getTenantIdentityPrefix(BIZ_B))
  })

  it('still allocates when a business has no Business Code yet', async () => {
    db.business.push({ id: 'biz_c', businessCode: null, name: 'No Code' })
    const { getTenantIdentityPrefix } = await import('@/lib/tenant-identity-server')
    const p = await getTenantIdentityPrefix('biz_c')
    expect(p).toBeTruthy()
    expect(p).not.toBe(deriveTenantPrefix(CODE_A))
  })

  it('resolves a collision deterministically instead of sharing a namespace', async () => {
    const { getTenantIdentityPrefix } = await import('@/lib/tenant-identity-server')
    // Squat tenant A's natural prefix with somebody else.
    db.tenantIdentity.push({ id: nid(), businessId: 'squatter', businessCode: 'X', prefix: '8T5' })
    const p = await getTenantIdentityPrefix(BIZ_A)
    expect(p).not.toBe('8T5')
    expect(db.tenantIdentity.filter((r) => r.prefix === p)).toHaveLength(1)
  })
})

describe('sequences are atomic, tenant-scoped and forward-only', () => {
  beforeEach(reset)

  it('EMP starts at 001 and counts up', async () => {
    const { issueEmployeeId } = await import('@/lib/tenant-identity-server')
    expect(await issueEmployeeId(BIZ_A, 'EMP')).toBe('8T5EMP001')
    expect(await issueEmployeeId(BIZ_A, 'EMP')).toBe('8T5EMP002')
    expect(await issueEmployeeId(BIZ_A, 'EMP')).toBe('8T5EMP003')
  })

  it('DL starts at 001 independently of EMP — §4', async () => {
    const { issueEmployeeId } = await import('@/lib/tenant-identity-server')
    await issueEmployeeId(BIZ_A, 'EMP')
    await issueEmployeeId(BIZ_A, 'EMP')
    expect(await issueEmployeeId(BIZ_A, 'DL')).toBe('8T5DL001')
    expect(await issueEmployeeId(BIZ_A, 'DL')).toBe('8T5DL002')
    expect(await issueEmployeeId(BIZ_A, 'EMP')).toBe('8T5EMP003')
  })

  it('one tenant cannot move another tenant\'s counter', async () => {
    const { issueEmployeeId } = await import('@/lib/tenant-identity-server')
    for (let i = 0; i < 7; i++) await issueEmployeeId(BIZ_A, 'EMP')
    expect(await issueEmployeeId(BIZ_B, 'EMP')).toBe('8T12EMP001')
  })

  it('100 simultaneous issues produce 100 distinct ids — §6', async () => {
    const { issueEmployeeId } = await import('@/lib/tenant-identity-server')
    const out = await Promise.all(Array.from({ length: 100 }, () => issueEmployeeId(BIZ_A, 'EMP')))
    expect(new Set(out).size).toBe(100)
  })

  it('never counts rows or scans for a maximum', () => {
    const src = codeOnly(read('src/lib/tenant-identity-server.ts'))
    const fn = src.slice(src.indexOf('export async function nextEmployeeSequence'))
    expect(fn).toMatch(/increment: 1/)
    expect(fn.slice(0, fn.indexOf('export async function heal'))).not.toMatch(/\.count\(|orderBy|findMany/)
  })

  it('an archived employee\'s number is never handed out again — §7', async () => {
    const { issueEmployeeId } = await import('@/lib/tenant-identity-server')
    const one = await issueEmployeeId(BIZ_A, 'EMP')
    const two = await issueEmployeeId(BIZ_A, 'EMP')
    // "Archive" #2 — the counter is untouched by employee state.
    expect(await issueEmployeeId(BIZ_A, 'EMP')).toBe('8T5EMP003')
    expect([one, two]).toEqual(['8T5EMP001', '8T5EMP002'])
  })

  it('healing only moves a counter forward, never back', async () => {
    const { healEmployeeSequence, issueEmployeeId } = await import('@/lib/tenant-identity-server')
    await issueEmployeeId(BIZ_A, 'EMP')            // next = 2
    await healEmployeeSequence(BIZ_A, 'EMP', 40)   // → 41
    expect(await issueEmployeeId(BIZ_A, 'EMP')).toBe('8T5EMP041')
    await healEmployeeSequence(BIZ_A, 'EMP', 5)    // must NOT rewind
    expect(await issueEmployeeId(BIZ_A, 'EMP')).toBe('8T5EMP042')
  })
})

describe('reconciliation of existing tenants', () => {
  beforeEach(reset)

  const owner = { id: 'bu_owner', userId: 'u_owner', businessId: BIZ_A, employeeCode: null, role: 'LAUNDRY_OWNER', createdAt: new Date(1) }
  const staff1 = { id: 'bu_1', userId: 'u_1', businessId: BIZ_A, employeeCode: null, role: 'STORE_EXECUTIVE', createdAt: new Date(2) }
  const staff2 = { id: 'bu_2', userId: 'u_2', businessId: BIZ_A, employeeCode: null, role: 'STORE_EXECUTIVE', createdAt: new Date(3) }

  it('gives staff ids, skips the Business Owner — §5', async () => {
    db.businessUser.push({ ...owner }, { ...staff1 }, { ...staff2 })
    const { reconcileStaffEmployeeIds } = await import('@/lib/laundry-employee-identity')
    await reconcileStaffEmployeeIds(BIZ_A, 'lb_a')
    expect(db.businessUser.find((r) => r.id === 'bu_owner')!.employeeCode).toBeNull()
    expect(db.businessUser.find((r) => r.id === 'bu_1')!.employeeCode).toBe('8T5EMP001')
    expect(db.businessUser.find((r) => r.id === 'bu_2')!.employeeCode).toBe('8T5EMP002')
  })

  it('is idempotent — a second run changes nothing', async () => {
    db.businessUser.push({ ...owner }, { ...staff1 }, { ...staff2 })
    const { reconcileStaffEmployeeIds } = await import('@/lib/laundry-employee-identity')
    await reconcileStaffEmployeeIds(BIZ_A, 'lb_a')
    const snapshot = JSON.stringify(db.businessUser)
    expect(await reconcileStaffEmployeeIds(BIZ_A, 'lb_a')).toBe(0)
    expect(JSON.stringify(db.businessUser)).toBe(snapshot)
  })

  it('never overwrites an id an employee already has — §10', async () => {
    db.businessUser.push({ ...staff1, employeeCode: '8T5EMP007' })
    const { reconcileStaffEmployeeIds } = await import('@/lib/laundry-employee-identity')
    await reconcileStaffEmployeeIds(BIZ_A, 'lb_a')
    expect(db.businessUser[0].employeeCode).toBe('8T5EMP007')
  })

  it('does not reuse a number already held by an existing employee', async () => {
    db.businessUser.push({ ...staff1, employeeCode: '8T5EMP009' }, { ...staff2 })
    const { reconcileStaffEmployeeIds } = await import('@/lib/laundry-employee-identity')
    await reconcileStaffEmployeeIds(BIZ_A, 'lb_a')
    expect(db.businessUser.find((r) => r.id === 'bu_2')!.employeeCode).toBe('8T5EMP010')
  })

  it('touches nothing but the code — §10', async () => {
    const row = { ...staff1, name: 'Jane', phone: '99', role: 'STORE_EXECUTIVE', isActive: true, passwordHash: 'HASH', storeId: 's1' }
    db.businessUser.push(row)
    const { reconcileStaffEmployeeIds } = await import('@/lib/laundry-employee-identity')
    await reconcileStaffEmployeeIds(BIZ_A, 'lb_a')
    const after = db.businessUser[0]
    expect(after.passwordHash).toBe('HASH')
    expect(after.role).toBe('STORE_EXECUTIVE')
    expect(after.isActive).toBe(true)
    expect(after.storeId).toBe('s1')
    expect(after.name).toBe('Jane')
  })

  it('a legacy EXE007 keeps its number and only gains the prefix — §11', async () => {
    db.laundryDeliveryExecutive.push({ id: 'e1', businessId: 'lb_a', employeeCode: 'EXE007', createdAt: new Date(1) })
    const { reconcileDeliveryExecutiveIds } = await import('@/lib/laundry-employee-identity')
    await reconcileDeliveryExecutiveIds(BIZ_A, 'lb_a')
    expect(db.laundryDeliveryExecutive[0].employeeCode).toBe('8T5DL007')
  })

  it('and the next executive does not collide with it', async () => {
    db.laundryDeliveryExecutive.push({ id: 'e1', businessId: 'lb_a', employeeCode: 'EXE007', createdAt: new Date(1) })
    const { reconcileDeliveryExecutiveIds } = await import('@/lib/laundry-employee-identity')
    await reconcileDeliveryExecutiveIds(BIZ_A, 'lb_a')
    const { issueEmployeeId } = await import('@/lib/tenant-identity-server')
    expect(await issueEmployeeId(BIZ_A, 'DL')).toBe('8T5DL008')
  })

  it('leaves an executive already in the current format alone', async () => {
    db.laundryDeliveryExecutive.push({ id: 'e1', businessId: 'lb_a', employeeCode: '8T5DL003', createdAt: new Date(1) })
    const { reconcileDeliveryExecutiveIds } = await import('@/lib/laundry-employee-identity')
    expect(await reconcileDeliveryExecutiveIds(BIZ_A, 'lb_a')).toBe(0)
    expect(db.laundryDeliveryExecutive[0].employeeCode).toBe('8T5DL003')
  })

  it('a delivery executive does not also consume a staff number', async () => {
    db.businessUser.push({ ...staff1, userId: 'u_exec' })
    db.laundryDeliveryExecutive.push({ id: 'e1', businessId: 'lb_a', userId: 'u_exec', employeeCode: '8T5DL001', createdAt: new Date(1) })
    const { reconcileStaffEmployeeIds } = await import('@/lib/laundry-employee-identity')
    await reconcileStaffEmployeeIds(BIZ_A, 'lb_a')
    expect(db.businessUser[0].employeeCode).toBeNull()
  })
})

describe('tenant isolation at login', () => {
  beforeEach(reset)

  it('an id resolves to its own tenant and to no other', async () => {
    const { getTenantIdentityPrefix, resolveTenantByEmployeeId } = await import('@/lib/tenant-identity-server')
    await getTenantIdentityPrefix(BIZ_A)
    await getTenantIdentityPrefix(BIZ_B)
    expect((await resolveTenantByEmployeeId('8T5EMP001'))!.businessId).toBe(BIZ_A)
    expect((await resolveTenantByEmployeeId('8T12EMP001'))!.businessId).toBe(BIZ_B)
    expect((await resolveTenantByEmployeeId('8T5DL001'))!.businessId).toBe(BIZ_A)
  })

  it('number 001 exists in both tenants and still never crosses', async () => {
    const { getTenantIdentityPrefix, resolveTenantByEmployeeId } = await import('@/lib/tenant-identity-server')
    await getTenantIdentityPrefix(BIZ_A)
    await getTenantIdentityPrefix(BIZ_B)
    const a = await resolveTenantByEmployeeId('8T5EMP001')
    const b = await resolveTenantByEmployeeId('8T12EMP001')
    expect(a!.sequence).toBe(b!.sequence)          // same number
    expect(a!.businessId).not.toBe(b!.businessId)  // different tenant
  })

  it('an unprefixed legacy id resolves to nobody rather than to everybody', async () => {
    const { resolveTenantByEmployeeId } = await import('@/lib/tenant-identity-server')
    for (const bad of ['EMP001', 'EXE001', 'DL001']) {
      expect(await resolveTenantByEmployeeId(bad)).toBeNull()
    }
  })

  it('a well-formed id with an unknown prefix resolves to nobody', async () => {
    const { resolveTenantByEmployeeId } = await import('@/lib/tenant-identity-server')
    expect(await resolveTenantByEmployeeId('ZZ999EMP001')).toBeNull()
  })
})

// ─── The two login endpoints, read as source ────────────────────────────────

describe('the login paths scope by identity before comparing a password', () => {
  const CORE = codeOnly(read('src/app/api/core/auth/login/route.ts'))
  const EXEC = codeOnly(read('src/app/api/laundry/executive/auth/login/route.ts'))

  it('staff login resolves the tenant from the employee id', () => {
    expect(CORE).toMatch(/resolveTenantByEmployeeId/)
    expect(CORE).toMatch(/businessId: employeeIdentity\.businessId/)
  })

  it('a well-formed employee id can never fall through to the email lookups', () => {
    // Each fallback is gated on the identifier NOT being an employee id.
    expect(CORE).toMatch(/if \(!user && !employeeIdentity\) \{/)
    expect(CORE).not.toMatch(/\n    if \(!user\) \{\n      user = await db\.user\.findUnique\(\{ where: \{ email/)
  })

  it('executive login scopes the query by the identity prefix', () => {
    expect(EXEC).toMatch(/resolveTenantByEmployeeId/)
    expect(EXEC).toMatch(/identityBusinessId \? \{ businessId: identityBusinessId \}/)
  })

  it('a prefixed id that names another tenant than the host is refused', () => {
    expect(EXEC).toMatch(/tenant && tenant\.laundryBusinessId !== lb\.id/)
    expect(EXEC).toMatch(/TENANT_MISMATCH_MESSAGE/)
  })

  it('an unknown prefix does not fall back to the unscoped search', () => {
    const slice = EXEC.slice(EXEC.indexOf('const parsedId'), EXEC.indexOf('Active executives matching'))
    expect(slice).toMatch(/if \(!identity\)/)
    expect(slice).toMatch(/401/)
  })

  it('no login path hardcodes a tenant', () => {
    for (const src of [CORE, EXEC]) expect(src).not.toMatch(/vastrasudha/i)
  })
})

// ─── Cross-product reuse (§18) ──────────────────────────────────────────────

describe('one identity, reusable by any product', () => {
  it('the resolver imports nothing product-specific', () => {
    const src = read('src/lib/tenant-identity.ts')
    expect(src).not.toMatch(/^import/m)                       // pure, no deps at all
    // Comments explain WHICH products reuse this; the code must not name them.
    expect(codeOnly(src).toLowerCase()).not.toMatch(/laundry|commerce/)
  })

  it('the server half knows nothing about laundry either', () => {
    const src = codeOnly(read('src/lib/tenant-identity-server.ts'))
    expect(src).not.toMatch(/laundryBusiness|laundryAccess|laundryDelivery/i)
  })

  it('there is exactly ONE prefix derivation in the codebase — §18', () => {
    const laundry = codeOnly(read('src/lib/laundry-employee-identity.ts'))
    expect(laundry).not.toMatch(/deriveTenantPrefix\s*\(/)     // laundry never derives
    expect(laundry).toMatch(/getTenantIdentityPrefix/)         // it asks
  })

  it('no admin surface can write a prefix', () => {
    const staffApi = codeOnly(read('src/app/api/laundry/staff/route.ts'))
    const execApi = codeOnly(read('src/app/api/laundry/delivery-executives/route.ts'))
    expect(staffApi).not.toMatch(/tenantIdentity/)
    expect(execApi).not.toMatch(/tenantIdentity/)
    // and the executive API no longer honours a typed code
    expect(execApi).not.toMatch(/b\.employeeCode/)
  })
})
