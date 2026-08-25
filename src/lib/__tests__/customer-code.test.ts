import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// ============================================================================
// CUS-{Business Code}-{6 digits}, per business, permanent, never reused.
//
// It used to embed whatever Business.businessCode held — so a legacy
// `BIZ-{SLUG}-{Date.now()}` produced CUS-BIZ-VASTRASUDHA-1787384817694-000007,
// a timestamp and a display name inside a permanent identifier — and it
// numbered by scanning for the highest existing code, which hands a number back
// out once the top customer is hard-deleted.
// ============================================================================

type Row = Record<string, unknown>
const store = { customers: [] as Row[], seq: [] as Row[], businesses: [] as Row[] }
let ids = 0

const match = (r: Row, w: Row) => Object.entries(w).every(([k, v]) => {
  if (v && typeof v === 'object' && 'lt' in (v as Row)) return (r[k] as Date) < ((v as Row).lt as Date)
  return r[k] === v
})

const client = {
  customer: {
    findMany: vi.fn(async (a?: never) => {
      const w = (a as { where?: Row } | undefined)?.where
      return (w ? store.customers.filter((r) => match(r, w)) : store.customers).map((r) => ({ ...r }))
    }),
    findFirst: vi.fn(async ({ where }: never) => store.customers.find((r) => match(r, where as Row)) ?? null),
    update: vi.fn(async ({ where, data }: never) => {
      const r = store.customers.find((x) => match(x, where as Row))!
      Object.assign(r, data as Row); return { ...r }
    }),
  },
  business: {
    findUnique: vi.fn(async ({ where }: never) => store.businesses.find((b) => match(b, where as Row)) ?? null),
    count: vi.fn(async () => store.businesses.length),
    update: vi.fn(async ({ where, data }: never) => {
      const b = store.businesses.find((x) => match(x, where as Row))!
      Object.assign(b, data as Row); return { ...b }
    }),
  },
  tenantEmployeeSequence: {
    findUnique: vi.fn(async ({ where }: never) => {
      const w = (where as Row).businessId_namespace as Row
      const hit = store.seq.find((r) => match(r, w))
      return hit ? { ...hit } : null
    }),
    create: vi.fn(async ({ data }: never) => {
      const d = data as Row
      if (store.seq.some((r) => r.businessId === d.businessId && r.namespace === d.namespace)) throw new Error('unique')
      const row = { id: `s${++ids}`, ...d }; store.seq.push(row); return { ...row }
    }),
    upsert: vi.fn(async ({ where, create, update }: never) => {
      const w = (where as Row).businessId_namespace as Row
      const found = store.seq.find((r) => match(r, w))
      if (!found) { const row = { id: `s${++ids}`, ...(create as Row) }; store.seq.push(row); return { ...row } }
      const inc = (update as Row).next as { increment: number }
      found.next = (found.next as number) + inc.increment
      return { ...found }
    }),
  },
}
vi.mock('@/lib/db', () => ({ db: client }))
vi.mock('@/lib/prisma', () => ({ prisma: client }))

const BIZ = 'biz_vastrasudha'
const OTHER = 'biz_other'
const gen = async (id = BIZ) => (await import('@/lib/customer-code')).generateCustomerCode(id)
const peek = async (id = BIZ) => (await import('@/lib/customer-code')).peekCustomerCode(id)

const reset = () => {
  store.customers = []; store.seq = []; ids = 0
  store.businesses = [
    { id: BIZ, businessCode: 'BUS-202608-0008', name: 'VASTRASUDHA', createdAt: new Date('2026-08-22') },
    { id: OTHER, businessCode: 'BUS-202606-0005', name: 'Laundry & Drycleaners', createdAt: new Date('2026-06-18') },
  ]
}

describe('1-7 · the format', () => {
  beforeEach(reset)

  it('is CUS-{Business Code}-{6 digits}, counting from 1', async () => {
    expect(await gen()).toBe('CUS-BUS-202608-0008-000001')
    expect(await gen()).toBe('CUS-BUS-202608-0008-000002')
    expect(await gen()).toBe('CUS-BUS-202608-0008-000003')
  })

  it('5 + 6. carries no timestamp and no uuid', async () => {
    const code = await gen()
    expect(code).toMatch(/^CUS-BUS-\d{6}-\d{4}-\d{6}$/)
    expect(code).not.toMatch(/\d{13}/)            // a ms timestamp
    expect(code).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/i)
  })

  it('7. uses the Business CODE, never the display name', async () => {
    expect(await gen()).not.toContain('VASTRASUDHA')
  })

  it('a legacy BIZ-{SLUG}-{timestamp} code is repaired, not embedded', async () => {
    store.businesses[0].businessCode = 'BIZ-VASTRASUDHA-1787384817694'
    const code = await gen()
    expect(code).not.toContain('1787384817694')
    expect(code).not.toContain('BIZ-')
    expect(code).toMatch(/^CUS-BUS-\d{6}-\d{4}-000001$/)
  })

  it('the sequence is PER BUSINESS', async () => {
    expect(await gen(BIZ)).toBe('CUS-BUS-202608-0008-000001')
    expect(await gen(OTHER)).toBe('CUS-BUS-202606-0005-000001')
    expect(await gen(BIZ)).toBe('CUS-BUS-202608-0008-000002')
    expect(await gen(OTHER)).toBe('CUS-BUS-202606-0005-000002')
  })
})

describe('8 + 11 · existing customers', () => {
  beforeEach(reset)

  it('11. continues from the highest existing number, across the OLD prefix', async () => {
    for (let i = 1; i <= 7; i++) {
      store.customers.push({ id: `c${i}`, businessId: BIZ, customerCode: `CUS-BIZ-VASTRASUDHA-1787384817694-${String(i).padStart(6, '0')}` })
    }
    expect(await gen()).toBe('CUS-BUS-202608-0008-000008')
  })

  it('8 + 9. and never rewrites one', async () => {
    store.customers.push({ id: 'c1', businessId: BIZ, customerCode: 'CUS-BIZ-VASTRASUDHA-1787384817694-000007' })
    const before = JSON.parse(JSON.stringify(store.customers))
    await gen(); await gen()
    expect(store.customers).toEqual(before)
    expect(client.customer.update).not.toHaveBeenCalled()
  })

  it('a business with no customers starts at 000001', async () => {
    expect(await gen()).toBe('CUS-BUS-202608-0008-000001')
  })
})

describe('3 + 10 · numbers are never reused', () => {
  beforeEach(reset)

  it('10. deleting the highest customer does not free its number', async () => {
    const a = await gen(); const b = await gen(); const c = await gen()
    expect([a, b, c]).toEqual([
      'CUS-BUS-202608-0008-000001', 'CUS-BUS-202608-0008-000002', 'CUS-BUS-202608-0008-000003',
    ])
    store.customers.push({ id: 'c3', businessId: BIZ, customerCode: c })
    store.customers = store.customers.filter((x) => x.customerCode !== c)   // hard delete
    expect(await gen()).toBe('CUS-BUS-202608-0008-000004')                  // NOT 000003
  })

  it('the counter only moves forward, even if every customer is removed', async () => {
    await gen(); await gen(); await gen()
    store.customers = []
    expect(await gen()).toBe('CUS-BUS-202608-0008-000004')
  })
})

describe('12 · concurrency', () => {
  beforeEach(reset)

  it('simultaneous creates never receive the same number', async () => {
    const codes = await Promise.all(Array.from({ length: 25 }, () => gen()))
    expect(new Set(codes).size).toBe(25)
  })

  it('the number comes from an atomic increment, not a read-then-max', async () => {
    const src = readFileSync(join(__dirname, '../customer-code.ts'), 'utf8')
    expect(src).toContain('nextTenantSequence')
    // The old mechanism: scan existing codes and add one.
    expect(src).not.toContain('maxSeq + 1')
  })
})

describe('the preview does not consume a number', () => {
  beforeEach(reset)

  it('peek returns the next code and leaves the counter alone', async () => {
    expect(await peek()).toBe('CUS-BUS-202608-0008-000001')
    expect(await peek()).toBe('CUS-BUS-202608-0008-000001')
    expect(await gen()).toBe('CUS-BUS-202608-0008-000001')
    expect(await peek()).toBe('CUS-BUS-202608-0008-000002')
  })

  it('the reset-business-data preview uses peek, not the generator', () => {
    const src = readFileSync(join(__dirname, '../../app/api/core/admin/reset-business-data/route.ts'), 'utf8')
    expect(src).toContain('peekCustomerCode(businessId)')
    expect(src).not.toContain('generateCustomerCode(businessId)')
  })
})

describe('there is ONE customer-code generator', () => {
  it('the laundry one is gone, and every caller uses customer-code.ts', () => {
    const laundry = readFileSync(join(__dirname, '../laundry-codes.ts'), 'utf8')
    expect(laundry).not.toMatch(/export\s+(async\s+)?function\s+generateCustomerCode/)
    for (const f of ['../customer-identity.ts', '../storefront-auth.ts']) {
      // Either quote style — these files differ.
      expect(readFileSync(join(__dirname, f), 'utf8')).toMatch(/from ['"]@\/lib\/customer-code['"]/)
    }
  })

  it('it is keyed on the business id, never on a code string', () => {
    const src = readFileSync(join(__dirname, '../customer-code.ts'), 'utf8')
    expect(src).toContain('generateCustomerCode(businessId: string)')
    const identity = readFileSync(join(__dirname, '../customer-identity.ts'), 'utf8')
    expect(identity).toContain('generateCustomerCode(businessId)')
    expect(identity).not.toContain('businessCodeForCode')
  })
})

describe('the repair keeps each customer their own number', () => {
  const SRC = readFileSync(join(__dirname, '../../app/api/debug/customer-code-repair/route.ts'), 'utf8')

  it('rewrites only the prefix — the trailing number is carried across', () => {
    expect(SRC).toContain('const to = `${prefix}${n}`')
    expect(SRC).toContain('no number to keep')
  })

  it('is safe because the code is a label, not a key', () => {
    // customerCode appears on exactly one model; orders reference Customer.id.
    const schema = readFileSync(join(__dirname, '../../../prisma/schema.prisma'), 'utf8')
    expect((schema.match(/^\s+customerCode\s+String/gm) || [])).toHaveLength(1)
  })

  it('is idempotent and never overwrites someone else', () => {
    expect(SRC).toContain('already canonical')
    expect(SRC).toContain('is already taken')
  })

  it('needs an explicit confirm, and is platform-guarded', () => {
    expect(SRC).toContain("sp.get(\"confirm\") !== \"1\"")
    expect(SRC).toContain('platformOnly(req)')
  })
})
