import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// ============================================================================
// ONE ORDER → ONE OR MORE BAGS.
//
// Sorting sets the initial plan; Packing & QR may add to it when the physical
// load needs another bag. Every stage reads the SAME relation
// (LaundryBagAssignment — already one row per bag per order), so no stage keeps
// a counter of its own and they cannot drift (§15).
//
// Nothing here re-implements assignment: assignBagToOrder() remains the only
// writer and already rejects an unknown bag, another tenant's bag, a bag held by
// another order, and a damaged/lost/cleaning bag — and is idempotent when the
// same bag is re-scanned onto the same order.
// ============================================================================

const H = vi.hoisted(() => {
  const state = {
    assignments: [] as { id: string; bagId: string; businessId: string; orderId: string; status: string; assignedAt: Date }[],
    bags: [] as { id: string; bagNumber: string; qrValue: string; status: string; currentCustodianType: string; businessId: string; currentOrderId: string | null }[],
    assignCalls: [] as { code: string; orderId: string; lbId: string }[],
    assignResult: null as null | { ok: boolean; status?: number; error?: string; bagId?: string },
  }
  return {
    state,
    prisma: {
      // The delivery engine now reads each service's own bag requirement.
      // Default [] = no booked services, which must fall back to the
      // every-bag rule rather than blocking (see `applicable`).
      laundryOrderService: { findMany: vi.fn().mockResolvedValue([]) },
      laundryBagAssignment: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        findMany: vi.fn(async (a: any) => state.assignments
          .filter((r) => r.businessId === a.where.businessId && r.orderId === a.where.orderId)
          .sort((x, y) => x.assignedAt.getTime() - y.assignedAt.getTime())
          .map((r) => ({ ...r, bag: state.bags.find((b) => b.id === r.bagId) ?? null }))),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        count: vi.fn(async (a: any) => state.assignments.filter((r) => r.businessId === a.where.businessId && r.orderId === a.where.orderId).length),
      },
    },
    assignBagToOrder: vi.fn(async (o: { lbId: string; code: string; orderId: string }) => {
      state.assignCalls.push({ code: o.code, orderId: o.orderId, lbId: o.lbId })
      if (state.assignResult && !state.assignResult.ok) return state.assignResult
      const bag = state.bags.find((b) => b.businessId === o.lbId && (b.bagNumber === o.code || b.qrValue === o.code))
      if (!bag) return { ok: false, status: 404, error: 'Bag not found.' }
      if (bag.currentOrderId && bag.currentOrderId !== o.orderId) return { ok: false, status: 409, error: 'Bag already assigned to another order.' }
      if (bag.currentOrderId !== o.orderId) {
        bag.currentOrderId = o.orderId
        state.assignments.push({ id: `asg-${state.assignments.length + 1}`, bagId: bag.id, businessId: o.lbId, orderId: o.orderId, status: 'ASSIGNED', assignedAt: new Date(Date.now() + state.assignments.length * 1000) })
      }
      return { ok: true, bag }
    }),
  }
})

vi.mock('@/lib/prisma', () => ({ prisma: H.prisma }))
vi.mock('@/lib/laundry-bag-assign', () => ({ assignBagToOrder: H.assignBagToOrder }))

import { orderBags, orderBagCount, addBagToOrder, bagScanProgress } from '@/lib/laundry-order-bags'

const { state } = H
const LB = 'lb_vastrasudha'
const OTHER_LB = 'lb_other'
const ORDER = 'ord-1'
const OTHER_ORDER = 'ord-2'

const mkBag = (n: string, over: Partial<(typeof state.bags)[0]> = {}) => ({
  id: `bag-${n}`, bagNumber: n, qrValue: n, status: 'AVAILABLE',
  currentCustodianType: 'LAUNDRY', businessId: LB, currentOrderId: null, ...over,
})

beforeEach(() => {
  state.assignments = []
  state.bags = [mkBag('V8BAG002'), mkBag('V8BAG003'), mkBag('V8BAG004')]
  state.assignCalls = []
  state.assignResult = null
  vi.clearAllMocks()
})

// ── 1, 2, 3, 18 ────────────────────────────────────────────────────────────
describe('1,2,18 · one bag still works; 2,3 · many bags supported', () => {
  it('1,18 · a single-bag order reads back as exactly one bag', async () => {
    await addBagToOrder({ lbId: LB, orderId: ORDER, code: 'V8BAG002' })
    const bags = await orderBags(LB, ORDER)
    expect(bags).toHaveLength(1)
    expect(bags[0].bagNumber).toBe('V8BAG002')
    expect(bags[0].index).toBe(1)
    expect(await orderBagCount(LB, ORDER)).toBe(1)
  })

  it('2 · Sorting can put two bags on one order', async () => {
    await addBagToOrder({ lbId: LB, orderId: ORDER, code: 'V8BAG002' })
    await addBagToOrder({ lbId: LB, orderId: ORDER, code: 'V8BAG003' })
    expect((await orderBags(LB, ORDER)).map((b) => b.bagNumber)).toEqual(['V8BAG002', 'V8BAG003'])
  })

  it('3,4 · Packing can add a third — three bags on one order', async () => {
    for (const c of ['V8BAG002', 'V8BAG003']) await addBagToOrder({ lbId: LB, orderId: ORDER, code: c })
    const r = await addBagToOrder({ lbId: LB, orderId: ORDER, code: 'V8BAG004' })
    expect(r.ok).toBe(true)
    if (!r.ok) throw new Error('expected ok')
    expect(r.total).toBe(3)
    expect((await orderBags(LB, ORDER)).map((b) => b.index)).toEqual([1, 2, 3])
  })
})

// ── 5, 6, 11 ───────────────────────────────────────────────────────────────
describe('5,6,11 · adding never replaces, and never mints a bag number', () => {
  it('6 · the Sorting bags survive an addition, ids and order intact', async () => {
    await addBagToOrder({ lbId: LB, orderId: ORDER, code: 'V8BAG002' })
    await addBagToOrder({ lbId: LB, orderId: ORDER, code: 'V8BAG003' })
    const before = (await orderBags(LB, ORDER)).map((b) => b.assignmentId)

    await addBagToOrder({ lbId: LB, orderId: ORDER, code: 'V8BAG004' })
    const after = await orderBags(LB, ORDER)
    expect(after.map((b) => b.assignmentId).slice(0, 2)).toEqual(before)
    expect(after.map((b) => b.bagNumber)).toEqual(['V8BAG002', 'V8BAG003', 'V8BAG004'])
  })

  it('5,11 · it delegates to the existing assigner — no id generation here', async () => {
    await addBagToOrder({ lbId: LB, orderId: ORDER, code: 'V8BAG002' })
    expect(H.assignBagToOrder).toHaveBeenCalledWith(expect.objectContaining({ lbId: LB, orderId: ORDER, code: 'V8BAG002' }))
    const SRC = readFileSync(join(process.cwd(), 'src/lib/laundry-order-bags.ts'), 'utf8')
    for (const w of ['generateBagCode', 'issueBagId', 'BAG${', 'laundryBag.create']) expect(SRC, w).not.toContain(w)
  })
})

// ── 7, 8, 9 ────────────────────────────────────────────────────────────────
describe('7,8,9 · scanning is order- and tenant-safe', () => {
  it('7 · re-scanning the same bag does not add it twice', async () => {
    await addBagToOrder({ lbId: LB, orderId: ORDER, code: 'V8BAG002' })
    const again = await addBagToOrder({ lbId: LB, orderId: ORDER, code: 'V8BAG002' })
    expect(again.ok).toBe(true)
    if (!again.ok) throw new Error('expected ok')
    expect(again.alreadyOnOrder).toBe(true)
    expect(again.total).toBe(1)
    expect(await orderBagCount(LB, ORDER)).toBe(1)
  })

  it('8 · a bag held by another order is rejected', async () => {
    await addBagToOrder({ lbId: LB, orderId: OTHER_ORDER, code: 'V8BAG002' })
    const r = await addBagToOrder({ lbId: LB, orderId: ORDER, code: 'V8BAG002' })
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('expected rejection')
    expect(r.status).toBe(409)
    expect(r.error).toContain('another order')
  })

  it('9 · another tenant\'s bag is not found', async () => {
    const r = await addBagToOrder({ lbId: OTHER_LB, orderId: ORDER, code: 'V8BAG002' })
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('expected rejection')
    expect(r.status).toBe(404)
  })

  it('9 · the reader never returns a bag from another business', async () => {
    state.assignments.push({ id: 'asg-x', bagId: 'bag-foreign', businessId: LB, orderId: ORDER, status: 'ASSIGNED', assignedAt: new Date() })
    state.bags.push(mkBag('XXBAG001', { id: 'bag-foreign', businessId: OTHER_LB }))
    expect(await orderBags(LB, ORDER)).toHaveLength(0)
  })
})

// ── 10 · all bags must be accounted for ────────────────────────────────────
describe('10 · a stage must account for every bag', () => {
  const bags = [1, 2, 3].map((i) => ({ bagNumber: `V8BAG00${i + 1}` })) as never as Awaited<ReturnType<typeof orderBags>>

  it('reports N of M and blocks while any bag is missing', () => {
    const p = bagScanProgress(bags, ['V8BAG002', 'V8BAG003'])
    expect(p).toMatchObject({ total: 3, scanned: 2, complete: false })
    expect(p.message).toBe('2 of 3 bags scanned. Scan all bags before continuing.')
  })

  it('completes only when every bag is scanned', () => {
    const p = bagScanProgress(bags, ['V8BAG002', 'V8BAG003', 'V8BAG004'])
    expect(p).toMatchObject({ total: 3, scanned: 3, complete: true, message: null })
  })

  it('is case-insensitive and ignores an unrelated scan', () => {
    expect(bagScanProgress(bags, ['v8bag002', 'V8BAG999']).scanned).toBe(1)
  })

  it('a single-bag order completes on one scan', () => {
    const one = [{ bagNumber: 'V8BAG002' }] as never as Awaited<ReturnType<typeof orderBags>>
    expect(bagScanProgress(one, ['V8BAG002']).complete).toBe(true)
  })
})

// ── 12, 13, 15, 20 · one relation, read everywhere ─────────────────────────
describe('12,13,15,20 · every stage reads the same bag records', () => {
  it('the list survives delivery — a handed-over bag is still the order\'s bag', async () => {
    await addBagToOrder({ lbId: LB, orderId: ORDER, code: 'V8BAG002' })
    await addBagToOrder({ lbId: LB, orderId: ORDER, code: 'V8BAG003' })
    // Delivery closes the assignment and hands the bag to the customer.
    for (const a of state.assignments) a.status = 'HANDED_TO_CUSTOMER'
    for (const b of state.bags.filter((x) => x.currentOrderId === ORDER)) {
      b.status = 'HANDED_TO_CUSTOMER'; b.currentCustodianType = 'CUSTOMER'
    }
    const bags = await orderBags(LB, ORDER)
    expect(bags).toHaveLength(2)                                  // 13 · none dropped
    expect(bags.every((b) => b.custodian === 'CUSTOMER')).toBe(true)
    expect(bags.every((b) => !b.open)).toBe(true)
    expect(bags.every((b) => b.status !== 'AVAILABLE')).toBe(true) // not back in stock
  })

  it('17 · a returned bag keeps its id and its assignment history', async () => {
    await addBagToOrder({ lbId: LB, orderId: ORDER, code: 'V8BAG002' })
    const [before] = await orderBags(LB, ORDER)
    state.assignments[0].status = 'RETURNED'
    const [after] = await orderBags(LB, ORDER)
    expect(after.bagId).toBe(before.bagId)
    expect(after.bagNumber).toBe('V8BAG002')
    expect(after.assignmentId).toBe(before.assignmentId)          // the row is not replaced
  })

  it('15 · the count is derived, never stored on the order', () => {
    const SRC = readFileSync(join(process.cwd(), 'src/lib/laundry-order-bags.ts'), 'utf8')
    expect(SRC).toContain('prisma.laundryBagAssignment.findMany')
    expect(SRC).toContain('prisma.laundryBagAssignment.count')
    expect(SRC).not.toContain('bagCount')
    expect(SRC).not.toContain('deliveryBagNumber')
  })
})

// ── Wiring: Packing & QR and the API ───────────────────────────────────────
describe('3,10,19 · Packing & QR is wired to the same list', () => {
  const PACKING = readFileSync(join(process.cwd(), 'src/components/laundry/views/laundry-store-stages.tsx'), 'utf8')
  const LIST = readFileSync(join(process.cwd(), 'src/components/laundry/order-bag-list.tsx'), 'utf8')
  const API = readFileSync(join(process.cwd(), 'src/app/api/laundry/orders/[id]/bags/route.ts'), 'utf8')

  it('Packing reads the order\'s bags and renders them all', () => {
    expect(PACKING).toContain('const { bags, accounting, loadBags } = useOrderBags(selected?.id ?? null, currentBusinessId)')
    expect(PACKING).toContain('<OrderBagList')
    expect(LIST).toContain('Bag {b.index} of {bags.length}')
  })

  it('3 · Packing offers + Add Another Bag', () => {
    expect(LIST).toContain('+ Add Another Bag')
    expect(LIST).toContain('`/api/laundry/orders/${orderId}/bags`')
    expect(LIST).toContain('method: "POST"')
  })

  it('19 · all bag labels can be generated in one action', () => {
    expect(LIST).toContain('Generate All Bag Labels')
    expect(LIST).toContain('printBagLabels(bags.map((b) => ({ bagNumber: b.bagNumber, qrValue: b.qrValue })))')
  })

  it('the API is permission-guarded and tenant-scoped', () => {
    expect(API).toContain('requireLaundryPermission(request, businessId, "laundry.orders.view")')
    expect(API).toContain('requireLaundryPermission(request, b.businessId, "store_ops.bag_management.operate")')
    expect(API).toContain('where: { id, businessId: biz.id }')
  })

  it('the API adds through the shared path, never a raw bag write', () => {
    expect(API).toContain('addBagToOrder({')
    expect(API).not.toContain('laundryBag.create')
    expect(API).not.toContain('laundryBagAssignment.create')
  })

  it('8 · bag scanning stays separate from garment scanning', () => {
    const LIB = readFileSync(join(process.cwd(), 'src/lib/laundry-order-bags.ts'), 'utf8')
    for (const w of ['garmentScanCode', 'GAR', 'barcode']) expect(LIB, w).not.toContain(w)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// SORTING MULTI-BAG.
//
// assignFinishingBag() refused a second bag outright ("Single active finishing
// bag per order — never a second"). Sorting now passes allowMultiple, so a
// DIFFERENT bag is ATTACHED through addBagToOrder → assignBagToOrder — the one
// writer, whose tenant / ownership / availability / duplicate checks are reused
// rather than restated. The finishing workstation does NOT pass it and still
// refuses a second bag.
// ═══════════════════════════════════════════════════════════════════════════

describe('Sorting · the one-bag restriction is lifted for Sorting only', () => {
  const FINISHING = readFileSync(join(process.cwd(), 'src/lib/laundry-finishing.ts'), 'utf8')
  const SORTING_API = readFileSync(join(process.cwd(), 'src/app/api/laundry/processing/sorting/route.ts'), 'utf8')
  const FINISHING_API = readFileSync(join(process.cwd(), 'src/app/api/laundry/processing/finishing-bag/route.ts'), 'utf8')
  const SORTING_UI = readFileSync(join(process.cwd(), 'src/components/laundry/views/laundry-sorting-workstation.tsx'), 'utf8')

  it('1,2,3 · Sorting opts in; the finishing workstation does not', () => {
    expect(SORTING_API).toContain('allowMultiple: true')
    expect(FINISHING_API).not.toContain('allowMultiple')
    // Default is off, so every other caller keeps the old single-bag rule.
    expect(FINISHING).toContain('if (!opts.allowMultiple) {')
    expect(FINISHING).toContain('code: "ALREADY_ASSIGNED"')
  })

  it('4,11,12 · an extra bag is ATTACHED through the single writer', () => {
    const branch = FINISHING.slice(FINISHING.indexOf('if (!opts.allowMultiple) {'), FINISHING.indexOf('// Scan-mode gate'))
    expect(branch).toContain('await addBagToOrder({ lbId: businessId, orderId, code: c,')
    // …and the extra bag records WHY it is on the order, exactly as the first
    // one does. Without the role it was written as an unclassified assignment
    // and could never be shown as one of the order's Sorting bags.
    expect(branch).toContain('purpose: BAG_PURPOSE.SORTING')
    // It re-implements none of the validation, and writes no bag row itself.
    for (const w of ['laundryBag.update', 'laundryBagAssignment.create', 'businessId: opts.lbId']) {
      expect(branch, w).not.toContain(w)
    }
  })

  it('5,11 · the first bag is never rewritten when a second is added', () => {
    const branch = FINISHING.slice(FINISHING.indexOf('if (!opts.allowMultiple) {'), FINISHING.indexOf('// Scan-mode gate'))
    // The package keeps its original bagCode — the transport identity.
    expect(branch).toContain('bagCode: already.bagCode || already.code')
    expect(branch).not.toContain('bagAssigned: true,')
    expect(branch).not.toContain('.delete(')
  })

  it('6 · re-scanning the same bag stays idempotent, before the multi-bag branch', () => {
    expect(FINISHING.indexOf('if (sameBag) {')).toBeLessThan(FINISHING.indexOf('if (!opts.allowMultiple) {'))
    expect(FINISHING).toContain('alreadyAssigned: true')
  })

  it('7,8,9 · an added bag still passes the scan-mode gate and every bag rule', () => {
    const branch = FINISHING.slice(FINISHING.indexOf('if (!opts.allowMultiple) {'), FINISHING.indexOf('// Scan-mode gate'))
    expect(branch).toContain('scanModeAcceptance(c, opts.mode)')
    expect(branch).toContain('added.status === 409 ? "WRONG_ORDER" : "INVALID"')
  })

  it('7 · adding a bag does NOT re-run the garment transition', () => {
    expect(SORTING_API).toContain('if (result.addedBag) {')
    // Anchored on the CODE that begins the completion (the transaction), not on
    // a comment: a reworded comment silently made this slice run to EOF, which
    // is how a passing assertion could stop covering the branch at all.
    const branch = SORTING_API.slice(SORTING_API.indexOf('if (result.addedBag) {'), SORTING_API.indexOf('await prisma.$transaction('))
    expect(branch.length).toBeGreaterThan(0)
    expect(branch.length).toBeLessThan(SORTING_API.length / 2)
    expect(branch).toContain('advanced: 0')
    for (const w of ['barcodeRetired', 'processingStage', 'updateMany']) expect(branch, w).not.toContain(w)
  })

  it('the garment gate is untouched — every garment still required first', () => {
    expect(SORTING_API).toContain('every garment must be scanned before the bag is assigned')
    expect(SORTING_API).toContain('atSorting.length !== order._count.items')
  })

  it('3,17 · Sorting shows the SAME shared list Packing reads', () => {
    expect(SORTING_UI).toContain('<OrderBagList')
    expect(SORTING_UI).toContain('useOrderBags(orderId, businessId)')
    expect(SORTING_UI).toContain('import { OrderBagList, useOrderBags } from "@/components/laundry/order-bag-list"')
  })

  it('15,16 · no sorting-specific bag counter was introduced', () => {
    for (const src of [FINISHING, SORTING_API, SORTING_UI]) {
      for (const w of ['sortingBagCount', 'numberOfSortingBags', 'bagCount']) expect(src, w).not.toContain(w)
    }
  })

  it('8,16 · Sorting gained no payment or OTP gate', () => {
    for (const w of ['balanceDue', 'paymentStatus', 'PAY_LATER', 'pickupOtp', 'deliveryOtp', 'verifyPickup']) {
      expect(SORTING_API, w).not.toContain(w)
    }
  })

  it('14 · Delivery was not touched', () => {
    for (const src of [FINISHING, SORTING_API, SORTING_UI]) {
      for (const w of ['deliveryBagNumber', 'deliveryBagAssignedAt', 'deliveryBagReturnedAt']) {
        expect(src, w).not.toContain(w)
      }
    }
  })
})
