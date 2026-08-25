import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// ============================================================================
// Subscription eligibility is decided PER GARMENT × SERVICE.
//
// Shirt may be covered under Wash & Fold and Wash & Iron but not under Dry
// Clean, and changing one must not disturb the others. No pair of a
// garment-wide flag and a service-wide flag can express that, so the decision
// lives on LaundryPricingRule — the row that IS the pair.
// ============================================================================

const ROOT = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

type Rule = { id: string; businessId: string; serviceId: string | null; garmentId: string | null; pricingType: string; price: number; minWeightKg: number | null; subscriptionIncluded: boolean | null; isActive: boolean; status: string; updatedAt: Date }
const db = { rules: [] as Rule[], services: [] as Record<string, unknown>[], garments: [] as Record<string, unknown>[] }
let seq = 0

vi.mock('@/lib/prisma', () => ({
  prisma: {
    laundryPricingRule: {
      findFirst: vi.fn(async ({ where }: never) => {
        const w = where as Record<string, unknown>
        return db.rules.find((r) => r.serviceId === w.serviceId && r.garmentId === w.garmentId) ?? null
      }),
      findMany: vi.fn(async () => db.rules.slice().sort((a, b) => +b.updatedAt - +a.updatedAt)),
      update: vi.fn(async ({ where, data }: never) => {
        const r = db.rules.find((x) => x.id === (where as { id: string }).id)!
        Object.assign(r, data as object, { updatedAt: new Date(Date.now() + ++seq) })
        return r
      }),
      updateMany: vi.fn(async ({ where, data }: never) => {
        const w = where as Record<string, unknown>
        for (const r of db.rules) if (r.serviceId === w.serviceId && r.garmentId === w.garmentId) Object.assign(r, data as object)
        return { count: 1 }
      }),
      create: vi.fn(async ({ data }: never) => {
        const r = { id: `r${++seq}`, subscriptionIncluded: null, minWeightKg: null, updatedAt: new Date(Date.now() + seq), ...(data as object) } as Rule
        db.rules.push(r)
        return r
      }),
    },
    laundryService: { findMany: vi.fn(async () => db.services) },
    laundryGarment: { findMany: vi.fn(async () => db.garments) },
  },
}))

const LB = 'lb1'
const SHIRT = 'g_shirt'
const WF = 's_washfold', WI = 's_washiron', DC = 's_dryclean', SI = 's_steamiron'
const NAME: Record<string, string> = { [WF]: 'Wash & Fold', [WI]: 'Wash & Iron', [DC]: 'Dry Clean', [SI]: 'Steam Iron' }

const reset = () => {
  db.rules = []; db.services = []; db.garments = []; seq = 0
  // The OLD flags, both off — the state every existing tenant is in.
  for (const id of [WF, WI, DC, SI]) db.services.push({ id, subscriptionEligible: false })
  db.garments.push({ id: SHIRT, subscriptionIncluded: false })
}

const save = async (cells: { serviceId: string; mode: string; price?: number; subscriptionIncluded?: boolean }[]) => {
  const { saveGarmentCells } = await import('@/lib/laundry-pricing-matrix')
  await saveGarmentCells(LB, SHIRT, 'Shirt', cells as never, (id) => NAME[id] || 'Service')
}
const coverageOf = async () => {
  const { subscriptionCoverageRules } = await import('@/lib/laundry-subscription-server')
  const pairs = await subscriptionCoverageRules(LB)
  return new Set(pairs.map((p) => p.serviceId))
}
const flagOf = (sid: string) => db.rules.find((r) => r.serviceId === sid)?.subscriptionIncluded

describe('eligibility is independent for every garment × service pair', () => {
  beforeEach(reset)

  it('steps 1-6. three services set independently, and all three persist', async () => {
    await save([
      { serviceId: WF, mode: 'PER_KG', price: 35, subscriptionIncluded: true },
      { serviceId: WI, mode: 'PER_KG', price: 45, subscriptionIncluded: true },
      { serviceId: DC, mode: 'PER_KG', price: 99, subscriptionIncluded: false },
    ])
    expect(flagOf(WF)).toBe(true)
    expect(flagOf(WI)).toBe(true)
    expect(flagOf(DC)).toBe(false)

    const covered = await coverageOf()
    expect(covered.has(WF)).toBe(true)
    expect(covered.has(WI)).toBe(true)
    expect(covered.has(DC)).toBe(false)
  })

  it('changing ONLY Dry Clean leaves Wash & Fold and Wash & Iron alone', async () => {
    await save([
      { serviceId: WF, mode: 'PER_KG', price: 35, subscriptionIncluded: true },
      { serviceId: WI, mode: 'PER_KG', price: 45, subscriptionIncluded: true },
      { serviceId: DC, mode: 'PER_KG', price: 99, subscriptionIncluded: false },
    ])
    await save([{ serviceId: DC, mode: 'PER_KG', price: 99, subscriptionIncluded: true }])

    expect(flagOf(WF)).toBe(true)
    expect(flagOf(WI)).toBe(true)
    expect(flagOf(DC)).toBe(true)
    const covered = await coverageOf()
    expect([...covered].sort()).toEqual([DC, WF, WI].sort())
  })

  it('then changing ONLY Wash & Fold off leaves the other two included', async () => {
    await save([
      { serviceId: WF, mode: 'PER_KG', price: 35, subscriptionIncluded: true },
      { serviceId: WI, mode: 'PER_KG', price: 45, subscriptionIncluded: true },
      { serviceId: DC, mode: 'PER_KG', price: 99, subscriptionIncluded: true },
    ])
    await save([{ serviceId: WF, mode: 'PER_KG', price: 35, subscriptionIncluded: false }])

    expect(flagOf(WF)).toBe(false)
    expect(flagOf(WI)).toBe(true)
    expect(flagOf(DC)).toBe(true)
    const covered = await coverageOf()
    expect(covered.has(WF)).toBe(false)
    expect(covered.has(WI)).toBe(true)
    expect(covered.has(DC)).toBe(true)
  })

  it('two garments do not affect each other', async () => {
    const TSHIRT = 'g_tshirt'
    db.garments.push({ id: TSHIRT, subscriptionIncluded: false })
    const { saveGarmentCells } = await import('@/lib/laundry-pricing-matrix')
    await save([
      { serviceId: WF, mode: 'PER_KG', price: 35, subscriptionIncluded: true },
      { serviceId: DC, mode: 'PER_KG', price: 99, subscriptionIncluded: false },
    ])
    await saveGarmentCells(LB, TSHIRT, 'T-Shirt', [
      { serviceId: WF, mode: 'PER_KG', price: 30, subscriptionIncluded: false },
      { serviceId: DC, mode: 'PER_KG', price: 80, subscriptionIncluded: true },
    ] as never, (id) => NAME[id] || 'Service')

    const { subscriptionCoverageRules } = await import('@/lib/laundry-subscription-server')
    const pairs = await subscriptionCoverageRules(LB)
    const key = (s: string, g: string) => pairs.some((p) => p.serviceId === s && p.garmentId === g)
    expect(key(WF, SHIRT)).toBe(true)      // Shirt + Wash & Fold  = INCLUDED
    expect(key(DC, SHIRT)).toBe(false)     // Shirt + Dry Clean    = NOT
    expect(key(WF, TSHIRT)).toBe(false)    // T-Shirt + Wash & Fold = NOT
    expect(key(DC, TSHIRT)).toBe(true)     // T-Shirt + Dry Clean  = INCLUDED
  })

  it('pricing, mode and the per-KG minimum survive a subscription-only change', async () => {
    await save([{ serviceId: WF, mode: 'PER_KG', price: 35, subscriptionIncluded: false }])
    const before = { ...db.rules.find((r) => r.serviceId === WF)! }
    await save([{ serviceId: WF, mode: 'PER_KG', price: 35, subscriptionIncluded: true }])
    const after = db.rules.find((r) => r.serviceId === WF)!
    expect(after.price).toBe(before.price)
    expect(after.pricingType).toBe(before.pricingType)
    expect(after.id).toBe(before.id)          // same rule, not a duplicate
    expect(db.rules.filter((r) => r.serviceId === WF)).toHaveLength(1)
  })

  it('NA is not "not included" — switching to NA keeps the recorded eligibility', async () => {
    await save([{ serviceId: WF, mode: 'PER_KG', price: 35, subscriptionIncluded: true }])
    await save([{ serviceId: WF, mode: 'NOT_AVAILABLE' }])
    const r = db.rules.find((x) => x.serviceId === WF)!
    expect(r.isActive).toBe(false)            // NA deactivates the price…
    expect(r.subscriptionIncluded).toBe(true) // …and does not erase the decision
  })

  it('a caller that says nothing about subscriptions cannot clear it (bulk import)', async () => {
    await save([{ serviceId: WF, mode: 'PER_KG', price: 35, subscriptionIncluded: true }])
    await save([{ serviceId: WF, mode: 'PER_KG', price: 40 }])   // no subscription key
    expect(flagOf(WF)).toBe(true)
    expect(db.rules.find((r) => r.serviceId === WF)!.price).toBe(40)
  })
})

describe('existing eligibility is unchanged where nobody has decided per pair', () => {
  beforeEach(reset)

  it('an undecided pair falls back to the old service AND garment rule', async () => {
    // The old way of being covered: both legacy flags on, no per-pair value.
    db.services = db.services.map((s) => ({ ...s, subscriptionEligible: true }))
    db.garments = [{ id: SHIRT, subscriptionIncluded: true }]
    await save([{ serviceId: WF, mode: 'PER_KG', price: 35 }])   // no per-pair decision
    expect(flagOf(WF)).toBeNull()
    expect((await coverageOf()).has(WF)).toBe(true)
  })

  it('and stays uncovered when the legacy flags said so', async () => {
    await save([{ serviceId: WF, mode: 'PER_KG', price: 35 }])
    expect((await coverageOf()).has(WF)).toBe(false)
  })

  it('an explicit decision overrides the legacy flags in both directions', async () => {
    db.services = db.services.map((s) => ({ ...s, subscriptionEligible: true }))
    db.garments = [{ id: SHIRT, subscriptionIncluded: true }]
    await save([{ serviceId: WF, mode: 'PER_KG', price: 35, subscriptionIncluded: false }])
    expect((await coverageOf()).has(WF)).toBe(false)   // explicit false beats legacy true

    db.services = db.services.map((s) => ({ ...s, subscriptionEligible: false }))
    db.garments = [{ id: SHIRT, subscriptionIncluded: false }]
    await save([{ serviceId: WF, mode: 'PER_KG', price: 35, subscriptionIncluded: true }])
    expect((await coverageOf()).has(WF)).toBe(true)    // explicit true beats legacy false
  })
})

describe('the surfaces', () => {
  const UI = read('src/components/laundry/views/laundry-pricing-matrix.tsx')
  const API = read('src/app/api/laundry/pricing-matrix/route.ts')
  const SCHEMA = read('prisma/schema.prisma')

  it('the checkbox sits on the service row, and the global control is gone', () => {
    expect(UI).toContain('Included in Subscription')
    expect(UI).toContain('setCell(s.id, { sub: e.target.checked })')
    expect(UI).not.toContain('Include in Subscription')          // the old global radio
    expect(UI).not.toContain('Not Included in Subscription')
    expect(UI).not.toContain('setSubIncluded')
  })

  it('each cell carries its own value to and from the server', () => {
    expect(UI).toContain('sub: !!c?.subscriptionIncluded')
    expect(UI).toContain('subscriptionIncluded: cells[s.id].sub')
    expect(API).toContain('subscriptionIncluded: hit.explicit ?? inherited')
  })

  it('NA disables the box rather than pretending it means "not covered"', () => {
    expect(UI).toContain('disabled={c.mode === "NOT_AVAILABLE"}')
  })

  it('the matrix keeps NA / Per Piece / Per KG and the price', () => {
    expect(UI).toContain('"NOT_AVAILABLE", "PER_PIECE", "PER_KG"')
  })

  it('the flag lives on the pair, and is nullable so nothing needed a backfill', () => {
    const model = SCHEMA.slice(SCHEMA.indexOf('model LaundryPricingRule {'), SCHEMA.indexOf('\n}', SCHEMA.indexOf('model LaundryPricingRule {')))
    expect(model).toMatch(/subscriptionIncluded\s+Boolean\?/)
  })
})
