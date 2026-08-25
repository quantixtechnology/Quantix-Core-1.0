import { describe, it, expect, beforeEach, vi } from 'vitest'

// ============================================================================
// §15 — the whole round trip.
//
//   bulk delete the pricing master → matrix empty, history intact
//   → import the complete sheet → garments recreated by their own codes
//   → matrix matches the sheet → the old order still reads as it was
//
// The importer used to refuse a code it had not seen ("Unknown garment code"),
// which made that workflow impossible without hand-creating every garment.
// ============================================================================

type G = { id: string; businessId: string; code: string; name: string; categoryId: string | null; isActive: boolean }
type Rule = { id: string; businessId: string; garmentId: string | null; serviceId: string | null; pricingType: string; price: number; subscriptionIncluded: boolean | null; isActive: boolean; storeId: null; customerType: null; categoryId: null }
type Item = { id: string; orderId: string; garmentId: string | null; garmentName: string; price: number }

const db = { garments: [] as G[], rules: [] as Rule[], items: [] as Item[], services: [] as { id: string; businessId: string; name: string; isActive: boolean }[], categories: [] as { id: string; name: string }[] }
let seq = 0
const LB = 'lb1'

const like = (row: Record<string, unknown>, w: Record<string, unknown>): boolean =>
  Object.entries(w).every(([k, v]) => {
    if (v && typeof v === 'object' && 'in' in (v as Record<string, unknown>)) return ((v as { in: unknown[] }).in).includes(row[k])
    if (v && typeof v === 'object' && 'not' in (v as Record<string, unknown>)) return row[k] !== (v as { not: unknown }).not
    return row[k] === v
  })

vi.mock('@/lib/laundry-business', () => ({ resolveLaundryBusiness: vi.fn(async () => ({ id: LB, platformBusinessId: 'pb1' })) }))
vi.mock('@/lib/laundry-rbac', () => ({ requireLaundryPermission: vi.fn(async () => ({ ok: true, platformBusinessId: 'pb1', ctx: { laundryBusinessId: LB } })) }))
vi.mock('@/lib/laundry-garment-codes', () => ({ ensureGarmentCodes: vi.fn(async () => {}) }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    laundryGarment: {
      findMany: vi.fn(async ({ where }: never) => db.garments.filter((g) => like(g, where as Record<string, unknown>))),
      create: vi.fn(async ({ data }: never) => {
        const d = data as Record<string, unknown>
        if (db.garments.some((g) => g.businessId === d.businessId && g.code === d.code)) throw new Error('Unique constraint failed: (businessId, code)')
        const g: G = { id: `g${++seq}`, isActive: true, categoryId: null, ...(d as object) } as G
        db.garments.push(g); return g
      }),
      update: vi.fn(async ({ where, data }: never) => {
        const g = db.garments.find((x) => x.id === (where as { id: string }).id)!
        Object.assign(g, data as object); return g
      }),
      updateMany: vi.fn(async ({ where, data }: never) => {
        const hits = db.garments.filter((g) => like(g, where as Record<string, unknown>))
        hits.forEach((g) => Object.assign(g, data as object)); return { count: hits.length }
      }),
    },
    laundryService: { findMany: vi.fn(async ({ where }: never) => db.services.filter((s) => like(s, where as Record<string, unknown>))) },
    laundryCategory: {
      findMany: vi.fn(async () => db.categories),
      create: vi.fn(async ({ data }: never) => {
        const c = { id: `cat${++seq}`, ...(data as object) } as { id: string; name: string }
        db.categories.push(c); return c
      }),
    },
    laundryPricingRule: {
      deleteMany: vi.fn(async ({ where }: never) => {
        const w = where as Record<string, unknown>
        const before = db.rules.length
        db.rules = db.rules.filter((r) => !like(r, w))
        return { count: before - db.rules.length }
      }),
      findMany: vi.fn(async () => db.rules),
    },
  },
}))
vi.mock('@/lib/laundry-pricing-matrix', () => ({
  saveGarmentCells: vi.fn(async (lb: string, garmentId: string, _n: string, cells: { serviceId: string; mode: string; price?: number; subscriptionIncluded?: boolean }[]) => {
    for (const c of cells) {
      db.rules = db.rules.filter((r) => !(r.garmentId === garmentId && r.serviceId === c.serviceId))
      if (c.mode === 'NOT_AVAILABLE') continue
      db.rules.push({ id: `r${++seq}`, businessId: lb, garmentId, serviceId: c.serviceId, pricingType: c.mode, price: c.price ?? 0, subscriptionIncluded: c.subscriptionIncluded ?? null, isActive: true, storeId: null, customerType: null, categoryId: null })
    }
  }),
}))

const WF = 'sv_wf', DC = 'sv_dc'
const CODES = Array.from({ length: 54 }, (_, i) => `GAR${String(i + 1).padStart(5, '0')}`)

const reset = () => {
  seq = 0
  db.services = [{ id: WF, businessId: LB, name: 'Wash & Fold', isActive: true }, { id: DC, businessId: LB, name: 'Dry Clean', isActive: true }]
  db.categories = [{ id: 'cat_men', name: 'Men' }]
  db.garments = CODES.map((code, i) => ({ id: `g_${i}`, businessId: LB, code, name: `Garment ${i + 1}`, categoryId: 'cat_men', isActive: true }))
  db.rules = db.garments.map((g, i) => ({ id: `r_${i}`, businessId: LB, garmentId: g.id, serviceId: WF, pricingType: 'PER_KG', price: 30 + i, subscriptionIncluded: null, isActive: true, storeId: null, customerType: null, categoryId: null }))
  // A historical order that used GAR00001, carrying its own snapshot.
  db.items = [{ id: 'it1', orderId: 'ord_20aug', garmentId: 'g_0', garmentName: 'Garment 1', price: 30 }]
}

const bulkDelete = async (body: Record<string, unknown>) => {
  const { POST } = await import('@/app/api/laundry/pricing-matrix/bulk-delete/route')
  const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ businessId: 'pb1', ...body }) }))
  return { status: res.status, body: await res.json() }
}
const importSheet = async (rows: unknown[]) => {
  const { POST } = await import('@/app/api/laundry/pricing-matrix/import/route')
  const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ businessId: 'pb1', rows }) }))
  return { status: res.status, body: await res.json() }
}
/** The sheet: every code, priced, with per-service subscription. */
const sheet = () => CODES.map((code, i) => ({
  code, name: `Garment ${i + 1}`, category: 'Men',
  cells: [
    { service: 'Wash & Fold', billing: 'PER_KG', price: 35, subscription: 'YES' },
    { service: 'Dry Clean', billing: i % 2 === 0 ? 'PER_PIECE' : 'NA', price: i % 2 === 0 ? 99 : '', subscription: 'NO' },
  ],
}))
const activeGarments = () => db.garments.filter((g) => g.isActive)

describe('§15 · bulk delete then rebuild from one Excel file', () => {
  beforeEach(reset)

  it('STEP 1. the master empties; history is untouched', async () => {
    const { body } = await bulkDelete({ scope: 'all', removeGarments: true })
    expect(body.success).toBe(true)
    expect(body.archived).toBe(54)
    expect(db.rules).toHaveLength(0)          // matrix has no pricing
    expect(activeGarments()).toHaveLength(0)  // and no current garments

    // Nothing was destroyed, and the old order still reads as processed.
    expect(db.garments).toHaveLength(54)
    expect(db.items[0]).toMatchObject({ garmentId: 'g_0', garmentName: 'Garment 1', price: 30 })
  })

  it('STEP 2-3. importing the sheet rebuilds the master — no "Unknown garment code"', async () => {
    await bulkDelete({ scope: 'all', removeGarments: true })
    const { status, body } = await importSheet(sheet())
    expect(status).toBe(200)
    expect(body.imported).toBe(54)
    expect(body.reactivated).toBe(54)   // same rows brought back, not duplicates
    expect(body.created).toBe(0)
    expect(activeGarments()).toHaveLength(54)
    expect(db.garments).toHaveLength(54)          // §6 — no second GAR00003
    expect(db.rules.filter((r) => r.serviceId === WF)).toHaveLength(54)
  })

  it('a code that never existed is CREATED with exactly that code', async () => {
    db.garments = db.garments.filter((g) => g.code !== 'GAR00003')
    const { status, body } = await importSheet(sheet())
    expect(status).toBe(200)
    expect(body.created).toBe(1)
    const made = db.garments.find((g) => g.code === 'GAR00003')!
    expect(made.name).toBe('Garment 3')
    expect(made.categoryId).toBe('cat_men')
    expect(made.isActive).toBe(true)
    expect(db.garments.filter((g) => g.code === 'GAR00003')).toHaveLength(1)
  })

  it('STEP 4. the old order is still intact after the whole round trip', async () => {
    const before = JSON.parse(JSON.stringify(db.items))
    await bulkDelete({ scope: 'all', removeGarments: true })
    await importSheet(sheet())
    expect(db.items).toEqual(before)
    // …and it was NOT reassigned to a newly made garment.
    expect(db.items[0].garmentId).toBe('g_0')
    expect(db.garments.find((g) => g.id === 'g_0')!.code).toBe('GAR00001')
  })

  it('STEP 5. the rebuilt pricing matches the sheet, per service', async () => {
    await bulkDelete({ scope: 'all', removeGarments: true })
    await importSheet(sheet())
    const g1 = db.garments.find((g) => g.code === 'GAR00001')!
    const wf = db.rules.find((r) => r.garmentId === g1.id && r.serviceId === WF)!
    expect(wf).toMatchObject({ pricingType: 'PER_KG', price: 35, subscriptionIncluded: true })
    const dc = db.rules.find((r) => r.garmentId === g1.id && r.serviceId === DC)!
    expect(dc).toMatchObject({ pricingType: 'PER_PIECE', price: 99, subscriptionIncluded: false })
  })

  it('§12. an NA cell stays unconfigured — no price is invented', async () => {
    await bulkDelete({ scope: 'all', removeGarments: true })
    await importSheet(sheet())
    const g2 = db.garments.find((g) => g.code === 'GAR00002')!   // odd index → Dry Clean NA
    expect(db.rules.find((r) => r.garmentId === g2.id && r.serviceId === DC)).toBeUndefined()
    expect(db.rules.find((r) => r.garmentId === g2.id && r.serviceId === WF)).toBeTruthy()
  })
})

describe('the guards around creating garments', () => {
  beforeEach(reset)

  it('a new code with no Garment Name is a row error, not a nameless garment', async () => {
    db.garments = db.garments.filter((g) => g.code !== 'GAR00003')
    const rows = sheet().map((r) => (r.code === 'GAR00003' ? { ...r, name: '' } : r))
    const { status, body } = await importSheet(rows)
    expect(status).toBe(422)
    expect(body.errors[0].message).toContain('Garment Name is required')
    expect(db.garments.some((g) => g.code === 'GAR00003')).toBe(false)   // nothing written
  })

  // There is no Categories screen any more, so a category named in the sheet is
  // part of the pricing master rather than a prerequisite built elsewhere.
  it('a category the tenant does not have yet is CREATED from the sheet', async () => {
    db.garments = db.garments.filter((g) => g.code !== 'GAR00003')
    const rows = sheet().map((r) => (r.code === 'GAR00003' ? { ...r, category: 'Household' } : r))
    const { status, body } = await importSheet(rows)
    expect(status).toBe(200)
    expect(body.newCategories).toEqual(['Household'])
    const made = db.categories.find((c) => c.name === 'Household')!
    expect(made).toBeTruthy()
    expect(db.garments.find((g) => g.code === 'GAR00003')!.categoryId).toBe(made.id)
  })

  it('an existing category is reused, case-insensitively — no near-duplicates', async () => {
    db.garments = db.garments.filter((g) => g.code === 'GAR00001')
    const rows = [{ ...sheet()[0], category: 'men' }, { ...sheet()[1], code: 'GAR00090', name: 'New One', category: 'MEN' }]
    const { status, body } = await importSheet(rows)
    expect(status).toBe(200)
    expect(body.newCategories).toEqual([])
    expect(db.categories).toHaveLength(1)
    expect(db.garments.find((g) => g.code === 'GAR00090')!.categoryId).toBe('cat_men')
  })

  it('the same new category twice in one file is created once', async () => {
    db.garments = []
    const rows = [
      { ...sheet()[0], code: 'GAR00101', name: 'A', category: 'Household' },
      { ...sheet()[1], code: 'GAR00102', name: 'B', category: 'Household' },
    ]
    const { status, body } = await importSheet(rows)
    expect(status).toBe(200)
    expect(body.newCategories).toEqual(['Household'])
    expect(db.categories.filter((c) => c.name === 'Household')).toHaveLength(1)
  })

  it('a blank category is allowed', async () => {
    db.garments = db.garments.filter((g) => g.code !== 'GAR00003')
    const rows = sheet().map((r) => (r.code === 'GAR00003' ? { ...r, category: '' } : r))
    expect((await importSheet(rows)).status).toBe(200)
    expect(db.garments.find((g) => g.code === 'GAR00003')!.categoryId).toBeNull()
  })

  it('an existing garment keeps its name — the sheet re-prices, it does not rename', async () => {
    const rows = sheet().map((r) => (r.code === 'GAR00001' ? { ...r, name: 'Renamed In Sheet' } : r))
    await importSheet(rows)
    expect(db.garments.find((g) => g.code === 'GAR00001')!.name).toBe('Garment 1')
  })

  it('a duplicate code in the file is refused before anything is written', async () => {
    const rows = [...sheet(), sheet()[0]]
    const { status, body } = await importSheet(rows)
    expect(status).toBe(422)
    expect(body.errors[0].message).toContain('Duplicate code')
  })
})

describe('bulk delete is a pricing-master action, never a history one', () => {
  beforeEach(reset)

  it('without the opt-in, garments stay in the master', async () => {
    const { body } = await bulkDelete({ scope: 'all' })
    expect(body.archived).toBe(0)
    expect(activeGarments()).toHaveLength(54)
    expect(db.rules).toHaveLength(0)
  })

  it('garments are ARCHIVED, never deleted, so no order item is orphaned', async () => {
    await bulkDelete({ scope: 'all', removeGarments: true })
    expect(db.garments).toHaveLength(54)
    expect(db.garments.every((g) => g.isActive === false)).toBe(true)
    expect(db.items.every((i) => db.garments.some((g) => g.id === i.garmentId))).toBe(true)
  })

  it('§13. it is scoped to this tenant', async () => {
    db.garments.push({ id: 'other', businessId: 'lb_other', code: 'GAR00001', name: 'Someone else', categoryId: null, isActive: true })
    await bulkDelete({ scope: 'all', removeGarments: true })
    expect(db.garments.find((g) => g.id === 'other')!.isActive).toBe(true)
  })

  it('deleting one service’s prices never removes garments', async () => {
    const { body } = await bulkDelete({ scope: 'service', serviceId: WF, removeGarments: true })
    expect(body.archived).toBe(0)
    expect(activeGarments()).toHaveLength(54)
  })
})
