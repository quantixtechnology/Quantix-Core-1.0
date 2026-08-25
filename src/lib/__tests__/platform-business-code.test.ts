import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

// ============================================================================
// The canonical Business Code — BUS-YYYYMM-NNNN.
//
// ONE identity per tenant, issued by ONE generator, for every product. The
// defect these tests pin down is a SECOND identity: `LND-YYYYMM-NNNN`, counted
// off a laundry-only sequence and written into the platform Business row, so a
// tenant that already held BUS-202606-0005 came to read LND-202608-0002.
//
// The two halves are equally important:
//   • going forward, no product may mint or supply a business identity;
//   • existing tenants keep every identifier they already have.
// ============================================================================

const ROOT = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

// ─── An in-memory Prisma with the semantics the real code relies on ─────────
type Row = Record<string, unknown>
const db = {
  business: [] as Row[],
  laundryBusiness: [] as Row[],
  tenantIdentity: [] as Row[],
  tenantEmployeeSequence: [] as Row[],
  businessUser: [] as Row[],
  laundryDeliveryExecutive: [] as Row[],
  laundryAccessAssignment: [] as Row[],
  customer: [] as Row[],
  laundryStore: [] as Row[],
  laundryOrder: [] as Row[],
}
let ids = 0
const nid = () => `r${++ids}`

const match = (row: Row, where: Row): boolean =>
  Object.entries(where).every(([k, v]) => {
    if (k === 'OR') return (v as Row[]).some((clause) => match(row, clause))
    if (v && typeof v === 'object' && 'not' in (v as Row)) return row[k] !== (v as Row).not
    if (v && typeof v === 'object' && 'lt' in (v as Row)) return (row[k] as Date) < ((v as Row).lt as Date)
    if (v && typeof v === 'object' && 'startsWith' in (v as Row)) {
      return typeof row[k] === 'string' && (row[k] as string).startsWith((v as Row).startsWith as string)
    }
    if (v && typeof v === 'object' && 'isOwner' in (v as Row)) return true
    return row[k] === v
  })

/** The unique index the schema declares on Business.businessCode. */
const uniqueClash = () => {
  const e = new Error('Unique constraint failed on the fields: (`businessCode`)') as Error & {
    code?: string; meta?: { target?: string[] }
  }
  e.code = 'P2002'
  e.meta = { target: ['businessCode'] }
  return e
}

vi.mock('@/lib/prisma', () => {
  const table = (name: keyof typeof db) => ({
    findUnique: vi.fn(async ({ where }: never) => {
      const w = where as Row
      const q = (w.businessId_namespace as Row | undefined) ?? w
      const hit = db[name].find((r) => match(r, q))
      return hit ? { ...hit } : null
    }),
    findFirst: vi.fn(async (args?: never) => {
      const a = args as { where?: Row; orderBy?: Row } | undefined
      const hit = db[name].find((r) => (a?.where ? match(r, a.where) : true))
      return hit ? { ...hit } : null
    }),
    findMany: vi.fn(async (args?: never) => {
      const a = args as { where?: Row; orderBy?: Row } | undefined
      const rows = (a?.where ? db[name].filter((r) => match(r, a.where!)) : db[name]).map((r) => ({ ...r }))
      const ob = a?.orderBy
      if (ob) {
        const [key, dir] = Object.entries(ob)[0] as [string, string]
        rows.sort((x, y) => {
          const xv = x[key] as never, yv = y[key] as never
          const c = xv < yv ? -1 : xv > yv ? 1 : 0
          return dir === 'desc' ? -c : c
        })
      }
      return rows
    }),
    count: vi.fn(async (args?: never) => {
      const w = (args as { where?: Row } | undefined)?.where
      return (w ? db[name].filter((r) => match(r, w)) : db[name]).length
    }),
    create: vi.fn(async ({ data }: never) => {
      const d: Row = { id: nid(), ...(data as Row) }
      if (name === 'business' && d.businessCode && db[name].some((r) => r.businessCode === d.businessCode)) throw uniqueClash()
      if (name === 'laundryBusiness' && db[name].some((r) => r.businessCode === d.businessCode)) throw uniqueClash()
      if (name === 'tenantIdentity' && db[name].some((r) => r.prefix === d.prefix || r.businessId === d.businessId)) {
        throw new Error('Unique constraint failed')
      }
      db[name].push(d)
      return { ...d }
    }),
    update: vi.fn(async ({ where, data }: never) => {
      const r = db[name].find((x) => match(x, where as Row))
      if (!r) throw new Error('not found')
      const d = data as Row
      if (name === 'business' && d.businessCode && db[name].some((x) => x !== r && x.businessCode === d.businessCode)) {
        throw uniqueClash()
      }
      Object.assign(r, d)
      return { ...r }
    }),
    upsert: vi.fn(async ({ where, create, update }: never) => {
      const w = (where as Row).businessId_namespace as Row
      const found = db[name].find((r) => match(r, w))
      if (!found) { const d: Row = { id: nid(), ...(create as Row) }; db[name].push(d); return { ...d } }
      const inc = (update as Row).next as { increment: number }
      found.next = (found.next as number) + inc.increment
      return { ...found }
    }),
  })
  const prisma = Object.fromEntries((Object.keys(db) as (keyof typeof db)[]).map((k) => [k, table(k)]))
  return { prisma }
})

// ─── The platform as it actually is: several products, one identity ─────────
const VASTRASUDHA = 'biz_vastrasudha'   // Laundry OS,  already correct
const DRYCLEANERS = 'biz_drycleaners'   // Laundry OS,  the employee-id reference
const VENKYS      = 'biz_venkys'        // Commerce
const PHARMACY    = 'biz_pharmacy'      // Commerce (pharmacy), a legacy BIZ- code

const reset = () => {
  for (const k of Object.keys(db) as (keyof typeof db)[]) db[k].length = 0
  ids = 0
  db.business.push(
    { id: VASTRASUDHA, name: 'VASTRASUDHA', slug: 'vastrasudha', businessCode: 'BUS-202606-0005',
      businessType: 'LAUNDRY', productCode: 'LAUNDRY', createdAt: new Date('2026-06-10') },
    { id: DRYCLEANERS, name: 'Laundry & Drycleaners', slug: 'laundrydrycleaners', businessCode: 'BUS-202606-0012',
      businessType: 'LAUNDRY', productCode: 'LAUNDRY', createdAt: new Date('2026-06-20') },
    { id: VENKYS, name: "Venky's Fresh Meat Store", slug: 'venkys', businessCode: 'BUS-202607-0003',
      businessType: 'MEAT_DELIVERY', productCode: 'COMMERCE', createdAt: new Date('2026-07-02') },
    { id: PHARMACY, name: 'Pharmacy Demo Store', slug: 'pharmacydemo', businessCode: 'BIZ-PHARMACYDEMO-1784010222908',
      businessType: 'PHARMACY', productCode: 'COMMERCE', createdAt: new Date('2026-07-05') },
  )
  // The laundry product's own row still carries its retired product code.
  db.laundryBusiness.push(
    { id: 'lb_vs', platformBusinessId: VASTRASUDHA, businessCode: 'LND-BUS-202606-0005', businessName: 'VASTRASUDHA', createdAt: new Date('2026-06-10') },
    { id: 'lb_dc', platformBusinessId: DRYCLEANERS, businessCode: 'LND-202606-0002', businessName: 'Laundry & Drycleaners', createdAt: new Date('2026-06-20') },
  )
}

const codeOf = (id: string) => db.business.find((b) => b.id === id)!.businessCode as string | null

// ════════════════════════════════════════════════════════════════════════════

describe('§1 — the canonical Business Code', () => {
  beforeEach(reset)

  it('2. a new business is issued BUS-YYYYMM-NNNN', async () => {
    const { allocateBusinessCode } = await import('@/lib/business-code')
    const code = await allocateBusinessCode(undefined, new Date('2026-08-25'))
    expect(code).toMatch(/^BUS-\d{6}-\d{4}$/)
    expect(code).toBe('BUS-202608-0005') // 4 tenants exist → the 5th
  })

  it('3 + 14. the allocator never hands back a number already taken', async () => {
    const { allocateBusinessCode } = await import('@/lib/business-code')
    // A code from THIS month already in use: the natural ordinal is occupied.
    db.business.push({ id: 'squatter', name: 'X', businessCode: 'BUS-202608-0005', createdAt: new Date('2026-08-01') })
    const code = await allocateBusinessCode(undefined, new Date('2026-08-25'))
    expect(code).toBe('BUS-202608-0006')
    expect(db.business.filter((b) => b.businessCode === code)).toHaveLength(0)
  })

  it('4. a product prefix is not a Business Code', async () => {
    const { isCanonicalBusinessCode } = await import('@/lib/business-code')
    expect(isCanonicalBusinessCode('BUS-202606-0005')).toBe(true)
    for (const notACode of ['LND-202608-0002', 'COM-202608-0002', 'PHM-202608-0002', 'BTZ-202608-0002',
                            'BIZ-PHARMACYDEMO-1784010222908', '', null, undefined]) {
      expect(isCanonicalBusinessCode(notACode)).toBe(false)
    }
  })

  it('15. two concurrent creates cannot land on the same number', async () => {
    const { allocateBusinessCode, retryOnBusinessCodeClash } = await import('@/lib/business-code')
    const { prisma } = await import('@/lib/prisma')

    // Both read the tenant count before either has inserted — the race the
    // unique index exists to catch. The retry re-probes and moves on.
    const createOne = (name: string) =>
      retryOnBusinessCodeClash(async () => {
        const code = await allocateBusinessCode(undefined, new Date('2026-08-25'))
        await new Promise((r) => setTimeout(r, 0)) // widen the window
        return prisma.business.create({ data: { name, slug: name, businessCode: code, createdAt: new Date() } as never })
      })

    const [a, b] = await Promise.all([createOne('A'), createOne('B')])
    expect(a.businessCode).not.toBe(b.businessCode)
    const codes = db.business.map((x) => x.businessCode)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('a non-canonical code fails the create rather than being retried forever', async () => {
    const { retryOnBusinessCodeClash } = await import('@/lib/business-code')
    const slugClash = Object.assign(new Error('slug'), { code: 'P2002', meta: { target: ['slug'] } })
    await expect(retryOnBusinessCodeClash(async () => { throw slugClash })).rejects.toBe(slugClash)
  })
})

describe('§2 — existing tenants are not renumbered', () => {
  beforeEach(reset)

  it('1 + 11. VASTRASUDHA keeps BUS-202606-0005', async () => {
    const { ensureBusinessCode, reconcileBusinessCodes } = await import('@/lib/business-code')
    expect(await ensureBusinessCode(VASTRASUDHA)).toBe('BUS-202606-0005')
    await reconcileBusinessCodes()
    expect(codeOf(VASTRASUDHA)).toBe('BUS-202606-0005')
    expect(codeOf(DRYCLEANERS)).toBe('BUS-202606-0012')
    expect(codeOf(VENKYS)).toBe('BUS-202607-0003')
  })

  it('is idempotent — a healthy platform is read, never written', async () => {
    const { reconcileBusinessCodes } = await import('@/lib/business-code')
    db.business.find((b) => b.id === PHARMACY)!.businessCode = 'BUS-202607-0004'
    const { prisma } = await import('@/lib/prisma')
    const before = (prisma.business.update as ReturnType<typeof vi.fn>).mock.calls.length
    const result = await reconcileBusinessCodes()
    expect(result.repaired).toBe(0)
    expect((prisma.business.update as ReturnType<typeof vi.fn>).mock.calls.length).toBe(before)
  })

  it('10 + 11. repairing a legacy code leaves every derived identifier alone', async () => {
    // The pharmacy tenant is on the legacy BIZ- shape and has been trading.
    db.customer.push({ id: 'c1', businessId: PHARMACY, customerCode: 'CUS-BIZ-PHARMACYDEMO-1784010222908-000001' })
    db.laundryStore.push({ id: 's1', businessId: 'lb_vs', storeCode: 'STR-LND-BUS-202606-0005-002' })
    db.laundryOrder.push({ id: 'o1', businessId: 'lb_vs', orderNumber: 'ORD-STR-LND-BUS-202606-0005-002-000002' })

    const { reconcileBusinessCodes } = await import('@/lib/business-code')
    const repaired = await reconcileBusinessCodes()
    expect(repaired.repaired).toBe(1)
    expect(codeOf(PHARMACY)).toMatch(/^BUS-\d{6}-\d{4}$/)

    // Historical identifiers are historical. They are still exactly themselves,
    // still attached to the same tenant, and still resolvable by their code.
    expect(db.customer[0].customerCode).toBe('CUS-BIZ-PHARMACYDEMO-1784010222908-000001')
    expect(db.customer[0].businessId).toBe(PHARMACY)
    expect(db.laundryStore[0].storeCode).toBe('STR-LND-BUS-202606-0005-002')
    expect(db.laundryOrder[0].orderNumber).toBe('ORD-STR-LND-BUS-202606-0005-002-000002')
    expect(db.laundryOrder[0].businessId).toBe('lb_vs')
  })

  it('12. tenant routing is untouched — the repair writes only the code', async () => {
    const { reconcileBusinessCodes } = await import('@/lib/business-code')
    const { prisma } = await import('@/lib/prisma')
    await reconcileBusinessCodes()
    for (const call of (prisma.business.update as ReturnType<typeof vi.fn>).mock.calls) {
      expect(Object.keys((call[0] as { data: Row }).data)).toEqual(['businessCode'])
    }
    // Host resolution reads slug / DomainMapping, never businessCode.
    expect(db.business.find((b) => b.slug === 'pharmacydemo')!.id).toBe(PHARMACY)
    expect(db.business.find((b) => b.id === VASTRASUDHA)!.slug).toBe('vastrasudha')
  })

  it('14. a repair never collides with a code another tenant holds', async () => {
    const { reconcileBusinessCodes } = await import('@/lib/business-code')
    // Every canonical number this month is already spoken for.
    db.business.push(
      { id: 'x1', name: 'X1', businessCode: 'BUS-202607-0005', createdAt: new Date('2026-07-06') },
      { id: 'x2', name: 'X2', businessCode: null, createdAt: new Date('2026-07-07') },
    )
    await reconcileBusinessCodes()
    const codes = db.business.map((b) => b.businessCode).filter(Boolean)
    expect(new Set(codes).size).toBe(codes.length)
    expect(codeOf(PHARMACY)).not.toBe('BUS-202607-0005')
  })
})

describe('§3 — no product may supply the business identity', () => {
  beforeEach(reset)

  it('4. laundry never replaces the Business Code with LND-…', async () => {
    const { businessIdentitySource } = await import('@/lib/laundry-employee-identity')
    // The laundry row holds LND-BUS-202606-0005; the platform holds the code.
    const src = await businessIdentitySource(VASTRASUDHA, 'lb_vs')
    expect(src.code).toBe('BUS-202606-0005')
    expect(src.name).toBe('VASTRASUDHA')
  })

  it('4. a laundry tenant with NO platform code is repaired, not read from LND-', async () => {
    db.business.find((b) => b.id === DRYCLEANERS)!.businessCode = null
    const { businessIdentitySource } = await import('@/lib/laundry-employee-identity')
    const src = await businessIdentitySource(DRYCLEANERS, 'lb_dc')
    // LND-202606-0002 would have said "business number 2". It is not consulted.
    expect(src.code).toMatch(/^BUS-\d{6}-\d{4}$/)
    expect(codeOf(DRYCLEANERS)).toBe(src.code)
  })

  it('5 + 6. commerce, meat and pharmacy tenants use the SAME architecture', async () => {
    const { ensureBusinessCode } = await import('@/lib/business-code')
    expect(await ensureBusinessCode(VENKYS)).toBe('BUS-202607-0003')
    expect(await ensureBusinessCode(PHARMACY)).toMatch(/^BUS-\d{6}-\d{4}$/)
    // Product type is metadata; it never appears in the identity.
    for (const id of [VASTRASUDHA, DRYCLEANERS, VENKYS, PHARMACY]) {
      expect(codeOf(id)).toMatch(/^BUS-/)
    }
  })

  it('no source file mints a business code with a product prefix', () => {
    const files: string[] = []
    const walk = (dir: string) => {
      for (const entry of readdirSync(join(ROOT, dir))) {
        const rel = `${dir}/${entry}`
        if (statSync(join(ROOT, rel)).isDirectory()) { if (entry !== '__tests__') walk(rel); continue }
        if (/\.tsx?$/.test(entry)) files.push(rel)
      }
    }
    walk('src')

    // `businessCode: \`LND-…\``, `businessCode: 'BIZ-…'` — a literal identity
    // minted at the call site instead of taken from the platform allocator.
    const offenders = files.filter((f) => /businessCode:\s*[`'"][A-Z]{2,6}-/.test(read(f)))
    expect(offenders).toEqual([])

    // The laundry module no longer has a business-code generator at all.
    expect(read('src/lib/laundry-codes.ts')).not.toMatch(/export\s+(async\s+)?function\s+generateBusinessCode/)
  })
})

describe('§4 — employee identity derives from the Business Code', () => {
  beforeEach(reset)

  it('7 + 8. VASTRASUDHA / BUS-202606-0005 → V5EMP001, V5DL001', async () => {
    const { issueStaffEmployeeId, issueDeliveryEmployeeId } = await import('@/lib/laundry-employee-identity')
    expect(await issueStaffEmployeeId(VASTRASUDHA, 'lb_vs')).toBe('V5EMP001')
    expect(await issueStaffEmployeeId(VASTRASUDHA, 'lb_vs')).toBe('V5EMP002')
    expect(await issueDeliveryEmployeeId(VASTRASUDHA, 'lb_vs')).toBe('V5DL001')
    expect(await issueDeliveryEmployeeId(VASTRASUDHA, 'lb_vs')).toBe('V5DL002')
  })

  it('the two sequences are independent — §6', async () => {
    const { issueStaffEmployeeId, issueDeliveryEmployeeId } = await import('@/lib/laundry-employee-identity')
    await issueStaffEmployeeId(VASTRASUDHA, 'lb_vs')
    await issueStaffEmployeeId(VASTRASUDHA, 'lb_vs')
    expect(await issueDeliveryEmployeeId(VASTRASUDHA, 'lb_vs')).toBe('V5DL001')
  })

  it('9. two tenants cannot collide on a prefix', async () => {
    const { laundryTenantPrefix } = await import('@/lib/laundry-employee-identity')
    expect(await laundryTenantPrefix(VASTRASUDHA, 'lb_vs')).toBe('V5')
    expect(await laundryTenantPrefix(DRYCLEANERS, 'lb_dc')).toBe('L12')

    // Same initial, same business number, different month — a genuine clash.
    db.business.push({ id: 'biz_clash', name: 'Vastra Something', slug: 'vs2', businessCode: 'BUS-202609-0005', createdAt: new Date('2026-09-01') })
    db.laundryBusiness.push({ id: 'lb_clash', platformBusinessId: 'biz_clash', businessCode: 'BUS-202609-0005', businessName: 'Vastra Something' })
    const other = await laundryTenantPrefix('biz_clash', 'lb_clash')
    expect(other).not.toBe('V5')
    expect(new Set(db.tenantIdentity.map((r) => r.prefix)).size).toBe(db.tenantIdentity.length)
  })

  it('13. authentication resolves the tenant from the id before any password', async () => {
    const { issueStaffEmployeeId } = await import('@/lib/laundry-employee-identity')
    const { resolveTenantByEmployeeId } = await import('@/lib/tenant-identity-server')

    const vs = await issueStaffEmployeeId(VASTRASUDHA, 'lb_vs')       // V5EMP001
    const dc = await issueStaffEmployeeId(DRYCLEANERS, 'lb_dc')       // L12EMP001

    expect((await resolveTenantByEmployeeId(vs))!.businessId).toBe(VASTRASUDHA)
    expect((await resolveTenantByEmployeeId(dc))!.businessId).toBe(DRYCLEANERS)
    expect(await resolveTenantByEmployeeId('V5EMP999')).toMatchObject({ businessId: VASTRASUDHA })
    expect(await resolveTenantByEmployeeId('ZZ9EMP001')).toBeNull()
  })

  it('a prefix carrying the WRONG business number is corrected — the live VASTRASUDHA case', async () => {
    // Exactly production before the fix: the Business Code says 8, but the
    // persisted prefix says 2 because it was derived from LND-202608-0002.
    db.business.find((b) => b.id === VASTRASUDHA)!.businessCode = 'BUS-202608-0008'
    db.tenantIdentity.push({ id: 'ti_vs', businessId: VASTRASUDHA, businessCode: 'LND-202608-0002', prefix: 'V2' })
    db.businessUser.push(
      { id: 'bu_1', userId: 'u_1', businessId: VASTRASUDHA, employeeCode: 'V2EMP001', role: 'STORE_EXECUTIVE', createdAt: new Date(1) },
      { id: 'bu_2', userId: 'u_2', businessId: VASTRASUDHA, employeeCode: 'V2EMP002', role: 'STORE_EXECUTIVE', createdAt: new Date(2) },
    )
    db.laundryDeliveryExecutive.push({ id: 'e1', businessId: 'lb_vs', employeeCode: 'V2DL001', createdAt: new Date(1) })

    const { correctInterimTenantPrefix } = await import('@/lib/laundry-employee-identity')
    expect(await correctInterimTenantPrefix(VASTRASUDHA, 'lb_vs')).toBe(true)

    expect(db.tenantIdentity[0].prefix).toBe('V8')
    // Every sequence NUMBER is carried across; only the prefix moves.
    expect(db.businessUser.find((r) => r.id === 'bu_1')!.employeeCode).toBe('V8EMP001')
    expect(db.businessUser.find((r) => r.id === 'bu_2')!.employeeCode).toBe('V8EMP002')
    expect(db.laundryDeliveryExecutive[0].employeeCode).toBe('V8DL001')
  })

  it('a prefix carrying the RIGHT number is never touched', async () => {
    const { correctInterimTenantPrefix } = await import('@/lib/laundry-employee-identity')
    db.tenantIdentity.push({ id: 'ti_dc', businessId: DRYCLEANERS, businessCode: 'BUS-202606-0012', prefix: 'L12' })
    expect(await correctInterimTenantPrefix(DRYCLEANERS, 'lb_dc')).toBe(false)
    expect(db.tenantIdentity[0].prefix).toBe('L12')
  })

  it('a RENAME never moves a namespace — only the number is compared', async () => {
    db.tenantIdentity.push({ id: 'ti_vs', businessId: VASTRASUDHA, businessCode: 'BUS-202606-0005', prefix: 'V5' })
    db.business.find((b) => b.id === VASTRASUDHA)!.name = 'Zenith Laundry'   // V → Z
    const { correctInterimTenantPrefix } = await import('@/lib/laundry-employee-identity')
    expect(await correctInterimTenantPrefix(VASTRASUDHA, 'lb_vs')).toBe(false)
    expect(db.tenantIdentity[0].prefix).toBe('V5')
  })

  it('a clash suffix keeps its base number and is left alone', async () => {
    db.tenantIdentity.push({ id: 'ti_vs', businessId: VASTRASUDHA, businessCode: 'BUS-202606-0005', prefix: 'V5A1' })
    const { correctInterimTenantPrefix } = await import('@/lib/laundry-employee-identity')
    expect(await correctInterimTenantPrefix(VASTRASUDHA, 'lb_vs')).toBe(false)
    expect(db.tenantIdentity[0].prefix).toBe('V5A1')
  })

  it('a prefix already issued survives a Business Code repair — §3', async () => {
    const { laundryTenantPrefix } = await import('@/lib/laundry-employee-identity')
    const before = await laundryTenantPrefix(VASTRASUDHA, 'lb_vs')
    const { reconcileBusinessCodes } = await import('@/lib/business-code')
    await reconcileBusinessCodes()
    expect(await laundryTenantPrefix(VASTRASUDHA, 'lb_vs')).toBe(before)
  })
})

describe('§5 — a new laundry workspace embeds the canonical code', () => {
  beforeEach(reset)

  it('a workspace created for an existing Business takes its Business Code', async () => {
    db.business.push({ id: 'biz_new', name: 'New Laundry', slug: 'newlaundry', businessCode: 'BUS-202608-0009',
      businessType: 'LAUNDRY', productCode: 'LAUNDRY', createdAt: new Date('2026-08-01') })
    const { resolveLaundryBusiness } = await import('@/lib/laundry-business')
    const resolved = await resolveLaundryBusiness('biz_new')
    expect(resolved!.businessCode).toBe('BUS-202608-0009')
    expect(db.laundryBusiness.find((l) => l.platformBusinessId === 'biz_new')!.businessCode).toBe('BUS-202608-0009')
  })

  it('an EXISTING workspace keeps the code its store and order series embed', async () => {
    const { resolveLaundryBusiness } = await import('@/lib/laundry-business')
    const resolved = await resolveLaundryBusiness(VASTRASUDHA)
    // Renumbering this would strand STR-LND-BUS-202606-0005-002 and every
    // order under it. The retired code stays, as legacy/internal.
    expect(resolved!.businessCode).toBe('LND-BUS-202606-0005')
  })
})
