import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
// ADD MISSING GARMENT — behavioural regression tests.
//
// These run the REAL intake endpoint against an in-memory Prisma, because the
// thing worth protecting is what gets WRITTEN when a garment is added to an
// order that ALREADY has garments — the "+ Add missed garment" path — not what
// the source text says.
// ============================================================================

interface ItemRow {
  id: string; orderId: string; itemNumber: string | null
  serviceId: string | null; serviceName: string | null
  garmentId: string | null; garmentName: string | null
  categoryId: string | null; pricingRuleId: string | null; pricingType: string
  quantity: number; weightKg: number; unitPrice: number; lineAmount: number
  gstPercent: number; gstAmount: number; discount: number; total: number
  barcode: string | null; garmentScanCode: string | null
  inspectedAt: Date | null; barcodeGenerated: boolean; processingStage: string | null
}

const H = vi.hoisted(() => {
  const state = {
    items: [] as ItemRow[],
    orderServices: [] as { orderId: string; serviceId: string | null; serviceName: string }[],
    order: null as Record<string, unknown> | null,
    services: [] as { id: string; name: string; isActive: boolean; businessId: string }[],
    garments: [] as { id: string; name: string; categoryId: string | null; businessId: string }[],
    rules: [] as Record<string, unknown>[],
    seq: 0,
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clone = (v: any) => JSON.parse(JSON.stringify(v))

  const prismaMock = {
    laundryOrder: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      findUnique: vi.fn(async ({ where }: any) => {
        if (!state.order || state.order.id !== where.id) return null
        return {
          ...clone(state.order),
          _count: { items: state.items.filter((i) => i.orderId === where.id).length },
          services: state.orderServices.filter((s) => s.orderId === where.id).map((s) => ({ serviceId: s.serviceId, serviceName: s.serviceName })),
          items: state.items.filter((i) => i.orderId === where.id).map((i) => ({ serviceId: i.serviceId, serviceName: i.serviceName })),
        }
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      update: vi.fn(async ({ where, data }: any) => {
        if (state.order && state.order.id === where.id) Object.assign(state.order, data)
        return { id: where.id, grandTotal: (data.grandTotal ?? 0) }
      }),
    },
    laundryOrderItem: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      create: vi.fn(async ({ data }: any) => {
        const row = { id: `it_${++state.seq}`, inspectedAt: null, barcodeGenerated: false, processingStage: null, ...data } as ItemRow
        state.items.push(row)
        return clone(row)
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      findMany: vi.fn(async ({ where, select }: any) => {
        const rows = state.items.filter((i) => !where?.orderId || i.orderId === where.orderId)
        if (!select) return clone(rows)
        return rows.map((r) => Object.fromEntries(Object.keys(select).map((k) => [k, (r as never as Record<string, unknown>)[k] ?? null])))
      }),
      count: vi.fn(async () => state.items.length),
    },
    laundryOrderService: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      findMany: vi.fn(async ({ where }: any) =>
        clone(state.orderServices.filter((s) => s.orderId === where.orderId).map((s) => ({ serviceId: s.serviceId, serviceName: s.serviceName })))),
    },
    laundryService: { findMany: vi.fn(async () => clone(state.services)) },
    laundryGarment: { findMany: vi.fn(async () => clone(state.garments)) },
    laundryPricingRule: { findMany: vi.fn(async () => clone(state.rules)) },
    laundryOperationalConfig: { findUnique: vi.fn(async () => null) },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $transaction: vi.fn(async (fn: any) => fn(prismaMock)),
  }
  return { state, prismaMock }
})

vi.mock('@/lib/prisma', () => ({ prisma: H.prismaMock }))
vi.mock('@/lib/laundry-rbac', () => ({
  requireLaundryPermission: vi.fn(async () => ({ ok: true, ctx: { userName: 'Owner' } })),
  requireLaundryMember: vi.fn(async () => ({ ok: true, ctx: { userName: 'Owner' } })),
  isBusinessOwnerRole: () => true,
}))
vi.mock('@/lib/laundry-codes', () => ({
  nextGarScanCode: vi.fn(async () => `GAR${String(++H.state.seq).padStart(12, '0')}`),
  healGarSequenceCounter: vi.fn(async () => {}),
}))

import { POST as ADD_ITEMS } from '@/app/api/laundry/orders/[id]/items/route'

const BIZ = 'lb_1'
const SVC_WI = 'svc_wi'
const SVC_DC = 'svc_dc'
const ORDER_ID = 'ord_1'

const rule = (serviceId: string, garmentId: string, price: number) => ({
  id: `r_${serviceId}_${garmentId}`, businessId: BIZ, isActive: true,
  serviceId, garmentId, categoryId: null, customerType: null, storeId: null,
  pricingType: 'PER_PIECE', price, gstPercent: 0, minQuantity: null, priority: 0,
})

function seedOrderWithOneGarment() {
  H.state.items = []
  H.state.orderServices = [{ orderId: ORDER_ID, serviceId: SVC_WI, serviceName: 'Wash & Iron' }]
  // The seeded garment below already holds GAR000000000001 — start past it so
  // the in-memory minter cannot re-issue a code the fixture already used.
  H.state.seq = 1
  H.state.services = [
    { id: SVC_WI, name: 'Wash & Iron', isActive: true, businessId: BIZ },
    { id: SVC_DC, name: 'Dry Clean', isActive: true, businessId: BIZ },
  ]
  H.state.garments = [
    { id: 'g_shirt', name: 'Shirt', categoryId: null, businessId: BIZ },
    { id: 'g_trouser', name: 'Trouser', categoryId: null, businessId: BIZ },
    { id: 'g_blanket', name: 'Blanket', categoryId: null, businessId: BIZ },
  ]
  H.state.rules = [
    rule(SVC_WI, 'g_shirt', 50),
    rule(SVC_WI, 'g_trouser', 60),
    rule(SVC_DC, 'g_blanket', 200),
  ]
  H.state.order = {
    id: ORDER_ID, businessId: BIZ, orderNumber: 'ORD-1', storeId: 'st_1', customerType: 'PICKUP',
    subtotal: 50, gstTotal: 0, grandTotal: 50, balanceDue: 50, amountPaid: 0,
    totalWeightKg: 0, billedAt: new Date(),
  }
  // The garment recorded at intake — the order already has ONE.
  H.state.items.push({
    id: 'it_existing', orderId: ORDER_ID, itemNumber: 'ITM-ORD-1-0001',
    serviceId: SVC_WI, serviceName: 'Wash & Iron', garmentId: 'g_shirt', garmentName: 'Shirt',
    categoryId: null, pricingRuleId: `r_${SVC_WI}_g_shirt`, pricingType: 'PER_PIECE',
    quantity: 1, weightKg: 0, unitPrice: 50, lineAmount: 50, gstPercent: 0, gstAmount: 0,
    discount: 0, total: 50, barcode: 'GAR000000000001', garmentScanCode: 'GAR000000000001',
    inspectedAt: new Date(), barcodeGenerated: false, processingStage: null,
  })
}

const post = async (body: unknown) => {
  const res = await ADD_ITEMS(
    new Request('http://t/api', { method: 'POST', body: JSON.stringify(body) }),
    { params: Promise.resolve({ id: ORDER_ID }) },
  )
  return { status: res.status, json: await res.json() }
}

const itemsOnOrder = () => H.state.items.filter((i) => i.orderId === ORDER_ID)

beforeEach(() => { seedOrderWithOneGarment(); vi.clearAllMocks() })

describe('Add Missing Garment actually persists the garment', () => {
  it('adds a garment to an order that already has one', async () => {
    const before = itemsOnOrder().length
    const { status, json } = await post({ items: [{ serviceId: SVC_WI, garmentId: 'g_trouser', quantity: 1, weightKg: 0 }] })
    expect(json.error ?? null).toBe(null)
    expect(status).toBe(201)
    expect(json.success).toBe(true)
    expect(itemsOnOrder().length).toBe(before + 1)
  })

  it('the new garment is persisted with its own identity', async () => {
    await post({ items: [{ serviceId: SVC_WI, garmentId: 'g_trouser', quantity: 1, weightKg: 0 }] })
    const added = itemsOnOrder().find((i) => i.garmentId === 'g_trouser')
    expect(added).toBeTruthy()
    expect(added!.garmentName).toBe('Trouser')
    expect(added!.garmentScanCode).toBeTruthy()
    expect(added!.garmentScanCode).not.toBe('GAR000000000001')
    expect(added!.itemNumber).not.toBe('ITM-ORD-1-0001')
  })

  it('survives a reload — it is a real row, not client state', async () => {
    await post({ items: [{ serviceId: SVC_WI, garmentId: 'g_trouser', quantity: 1, weightKg: 0 }] })
    const reloaded = await H.prismaMock.laundryOrderItem.findMany({ where: { orderId: ORDER_ID } })
    expect(reloaded.map((r: ItemRow) => r.garmentId)).toContain('g_trouser')
  })

  it('counts toward barcode generation', async () => {
    await post({ items: [{ serviceId: SVC_WI, garmentId: 'g_trouser', quantity: 2, weightKg: 0 }] })
    // One existing + two physical trousers = three individually barcoded garments.
    expect(itemsOnOrder()).toHaveLength(3)
    const codes = itemsOnOrder().map((i) => i.garmentScanCode)
    expect(new Set(codes).size).toBe(3)
  })
})

describe('the added garment uses the order\'s booked service', () => {
  it('is stored under the booked service', async () => {
    await post({ items: [{ serviceId: SVC_WI, garmentId: 'g_trouser', quantity: 1, weightKg: 0 }] })
    const added = itemsOnOrder().find((i) => i.garmentId === 'g_trouser')
    expect(added!.serviceId).toBe(SVC_WI)
    expect(added!.serviceName).toBe('Wash & Iron')
  })

  it('a DIFFERENT service cannot be introduced by a missing-garment add', async () => {
    const before = itemsOnOrder().length
    const { status, json } = await post({ items: [{ serviceId: SVC_DC, garmentId: 'g_blanket', quantity: 1, weightKg: 0 }] })
    expect(status).toBe(400)
    expect(json.code).toBe('MULTIPLE_SERVICES')
    expect(itemsOnOrder().length).toBe(before) // nothing written
  })
})

describe('bad input is refused cleanly, writing nothing', () => {
  it('a garment with no service', async () => {
    const before = itemsOnOrder().length
    const { status, json } = await post({ items: [{ serviceId: null, garmentId: 'g_trouser', quantity: 1 }] })
    expect(status).toBe(400)
    expect(json.success).toBe(false)
    expect(itemsOnOrder().length).toBe(before)
  })

  it('no quantity and no weight', async () => {
    const before = itemsOnOrder().length
    const { status } = await post({ items: [{ serviceId: SVC_WI, garmentId: 'g_trouser', quantity: 0, weightKg: 0 }] })
    expect(status).toBe(400)
    expect(itemsOnOrder().length).toBe(before)
  })

  it('a garment the matrix cannot price under the booked service', async () => {
    const before = itemsOnOrder().length
    const { status, json } = await post({ items: [{ serviceId: SVC_WI, garmentId: 'g_blanket', quantity: 1, weightKg: 0 }] })
    expect(status).toBe(400)
    expect(json.code).toBe('SERVICE_NOT_AVAILABLE_FOR_GARMENT')
    expect(itemsOnOrder().length).toBe(before)
  })
})

describe('existing garments are never disturbed', () => {
  it('the original row is untouched and not duplicated', async () => {
    const original = { ...itemsOnOrder()[0] }
    await post({ items: [{ serviceId: SVC_WI, garmentId: 'g_trouser', quantity: 1, weightKg: 0 }] })
    const after = itemsOnOrder().find((i) => i.id === 'it_existing')!
    expect(after.quantity).toBe(original.quantity)
    expect(after.garmentScanCode).toBe(original.garmentScanCode)
    expect(after.inspectedAt).toBe(original.inspectedAt)
    expect(itemsOnOrder().filter((i) => i.garmentId === 'g_shirt')).toHaveLength(1)
  })

  it('the order total grows by exactly the added garment', async () => {
    await post({ items: [{ serviceId: SVC_WI, garmentId: 'g_trouser', quantity: 1, weightKg: 0 }] })
    expect(H.state.order!.grandTotal).toBe(110) // 50 existing + 60 trouser
  })
})

// ============================================================================
// THE ROOT CAUSE — the client refused the save before it ever reached the
// server above (which, as the tests above prove, was working correctly).
//
// Every "+ Add garment" click appends a PRISTINE row: no garment, quantity
// pre-filled to "1". The save classified a row as "started" if it had a garment
// OR any quantity, so that pristine row was started-but-incomplete and the
// WHOLE save was refused. An operator who lined up a spare row and pressed Save
// added nothing at all — Add Missing Garment appeared to do nothing.
// ============================================================================
import { intakeRowsToItems, rowTouched, DEFAULT_ROW_QUANTITY } from '@/lib/laundry-intake-service'
import { readFileSync } from 'fs'
import { join } from 'path'

const PRISTINE = { garmentId: '', quantity: DEFAULT_ROW_QUANTITY, weightKg: '' }
const shirt = { garmentId: 'g_shirt', quantity: '2', weightKg: '' }

describe('a pristine row is not a row the operator is trying to save', () => {
  it('an untouched row is not touched', () => {
    expect(rowTouched(PRISTINE)).toBe(false)
  })

  it('THE REGRESSION: a filled garment saves even with a spare pristine row', () => {
    const v = intakeRowsToItems([shirt, PRISTINE], 'svc_wi')
    expect(v.ok).toBe(true)
    if (v.ok) {
      expect(v.items).toHaveLength(1)
      expect(v.items[0]).toMatchObject({ garmentId: 'g_shirt', quantity: 2, serviceId: 'svc_wi' })
    }
  })

  it('several spare rows still do not block the save', () => {
    const v = intakeRowsToItems([shirt, PRISTINE, PRISTINE, PRISTINE], 'svc_wi')
    expect(v.ok).toBe(true)
    if (v.ok) expect(v.items).toHaveLength(1)
  })

  it('only pristine rows means there is genuinely nothing to add', () => {
    const v = intakeRowsToItems([PRISTINE, PRISTINE], 'svc_wi')
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.code).toBe('NO_GARMENTS')
  })
})

describe('a row the operator DID engage with is never dropped in silence', () => {
  it('a garment with the quantity cleared stops the save and names the row', () => {
    const v = intakeRowsToItems([shirt, { garmentId: 'g_trouser', quantity: '', weightKg: '' }], 'svc_wi')
    expect(v.ok).toBe(false)
    if (!v.ok) {
      expect(v.code).toBe('INCOMPLETE_ROWS')
      expect(v.error).toContain('row 2 has no quantity or weight')
      expect(v.error).toContain('Nothing was saved.')
    }
  })

  it('a typed quantity with no garment stops the save', () => {
    const v = intakeRowsToItems([{ garmentId: '', quantity: '3', weightKg: '' }], 'svc_wi')
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.error).toContain('row 1 has no garment')
  })

  it('a weight-only row with no garment stops the save', () => {
    const v = intakeRowsToItems([{ garmentId: '', quantity: DEFAULT_ROW_QUANTITY, weightKg: '4.5' }], 'svc_wi')
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.code).toBe('INCOMPLETE_ROWS')
  })
})

describe('every garment carries the order\'s locked service', () => {
  it('one service is stamped on every row, whatever the rows say', () => {
    const v = intakeRowsToItems([shirt, { garmentId: 'g_trouser', quantity: '1', weightKg: '' }], 'svc_wi')
    expect(v.ok).toBe(true)
    if (v.ok) expect(new Set(v.items.map((i) => i.serviceId))).toEqual(new Set(['svc_wi']))
  })

  it('a row cannot carry a service of its own — there is nowhere to put one', () => {
    const v = intakeRowsToItems([{ ...shirt, serviceId: 'svc_dc' } as never], 'svc_wi')
    expect(v.ok).toBe(true)
    if (v.ok) expect(v.items[0].serviceId).toBe('svc_wi')
  })

  it('no service means no save', () => {
    const v = intakeRowsToItems([shirt], '')
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.code).toBe('NO_SERVICE')
  })

  it('a per-KG row keeps its weight', () => {
    const v = intakeRowsToItems([{ garmentId: 'g_blanket', quantity: '0', weightKg: '3.5' }], 'svc_wi')
    expect(v.ok).toBe(true)
    if (v.ok) expect(v.items[0]).toMatchObject({ weightKg: 3.5, quantity: 0 })
  })
})

describe('the screen uses the shared rule, not its own copy', () => {
  const AUDIT = readFileSync(join(process.cwd(), 'src/components/laundry/views/laundry-store-audit.tsx'), 'utf8')

  it('the save path goes through intakeRowsToItems', () => {
    expect(AUDIT).toContain('const plan = intakeRowsToItems(rows, serviceId)')
  })

  it('the old hand-rolled row filter is gone', () => {
    expect(AUDIT).not.toContain('const started = rows.filter((r) => r.garmentId || filled(r))')
  })

  it('new rows are built from the same default the rule judges by', () => {
    expect(AUDIT).toContain('quantity: DEFAULT_ROW_QUANTITY')
    expect(AUDIT).not.toContain('{ garmentId: "", quantity: "1", weightKg: "" }')
  })

  it('Store Visit / New Order is a different screen and was not touched', () => {
    const NEW_ORDER = readFileSync(join(process.cwd(), 'src/components/laundry/views/laundry-new-order.tsx'), 'utf8')
    expect(NEW_ORDER).not.toContain('intakeRowsToItems')
  })
})
