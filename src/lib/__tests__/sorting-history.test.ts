import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// ============================================================================
// SORTING HISTORY — an audit view of orders that ACTUALLY completed the stage.
//
// Sorting does three separate things that must never be confused:
//
//   BAG ASSIGNMENT      happens many times — Bag 1, Bag 2, Bag 3.
//   SORTING COMPLETION  happens once, when every garment has been scanned and
//                       the server retires the barcodes and advances the order.
//   SORTING HISTORY     records the completion and shows the bags it used.
//
// The qualifying record is the LaundryOrderEvent action "SORTING_COMPLETE" —
// written in exactly one place, LAST, after every gate has passed AND after the
// garments have actually been advanced out of the stage.
//
// It is NOT LaundryProcessingPackage.bagAssigned: that flag is also set by
// /api/laundry/processing/finishing-bag, which binds the same bag under the same
// gates but never advances the garments. Keying History on it listed an order as
// completed while it was still on the active queue — asserted below.
//
// No schema change was needed: the completion flag, its timestamp and the bag
// rows all already existed. This suite drives the REAL route handler and the
// REAL bag reader against mocked data.
// ============================================================================

const mocks = vi.hoisted(() => ({
  eventFindMany: vi.fn(),
  packageFindMany: vi.fn(),
  orderFindMany: vi.fn(),
  customerFindMany: vi.fn(),
  assignmentFindMany: vi.fn(),
  itemFindMany: vi.fn(),
  requireLaundryPermission: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    laundryProcessingPackage: { findMany: mocks.packageFindMany, findFirst: vi.fn() },
    laundryOrder: { findMany: mocks.orderFindMany, findFirst: vi.fn() },
    customer: { findMany: mocks.customerFindMany },
    laundryBagAssignment: { findMany: mocks.assignmentFindMany },
    laundryOrderItem: { findMany: mocks.itemFindMany, count: vi.fn() },
    laundryOrderEvent: { findMany: mocks.eventFindMany },
  },
}))
vi.mock('@/lib/laundry-business', () => ({
  resolveLaundryBusiness: vi.fn(async () => ({ id: 'lb1', platformBusinessId: 'pb1', businessCode: 'BUS-1' })),
}))
vi.mock('@/lib/laundry-rbac', () => ({ requireLaundryPermission: mocks.requireLaundryPermission }))

import { GET } from '@/app/api/laundry/processing/sorting/route'
import { sortingBagsEver, type SortingBagRow } from '@/lib/laundry-sorting-bags'

const COMPLETED_AT = new Date('2026-08-30T12:00:00Z')

/** An assignment row as orderBags() reads it, straight off the relation. */
const row = (bagNumber: string, purpose: string | null, at: string, over: Record<string, unknown> = {}) => ({
  id: `a-${bagNumber}`, bagId: `b-${bagNumber}`, orderId: 'ord1', businessId: 'lb1',
  serviceId: 'svc1', serviceName: 'Wash', status: 'ASSIGNED', purpose,
  assignedAt: new Date(at),
  bag: { id: `b-${bagNumber}`, bagNumber, qrValue: bagNumber, status: 'COLLECTED', currentCustodianType: 'PROCESSING_CENTER', businessId: 'lb1' },
  ...over,
})

const history = async (qs = '') => {
  const res = await GET(new Request(`http://t/api/laundry/processing/sorting?businessId=pb1&history=1${qs}`))
  return { res, json: await res.json() }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireLaundryPermission.mockResolvedValue({ ok: true })
  mocks.eventFindMany.mockResolvedValue([
    { orderId: 'ord1', createdAt: COMPLETED_AT, actorName: 'raju' },
  ])
  mocks.packageFindMany.mockResolvedValue([])
  mocks.orderFindMany.mockResolvedValue([
    { id: 'ord1', orderNumber: 'ORD-STR-BUS-202608-0008-002-000036', status: 'IN_PROCESSING', customerId: 'c1', _count: { items: 18 } },
  ])
  mocks.customerFindMany.mockResolvedValue([{ id: 'c1', name: 'Raju' }])
  mocks.assignmentFindMany.mockResolvedValue([row('VBBAG001', 'SORTING', '2026-08-30T10:00:00Z')])
  mocks.itemFindMany.mockResolvedValue([])
})

describe('A · a successful completion appears in History', () => {
  it('returns the completed order with its identity and totals', async () => {
    const { res, json } = await history()
    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.history).toHaveLength(1)
    expect(json.history[0]).toMatchObject({
      orderId: 'ord1',
      orderNumber: 'ORD-STR-BUS-202608-0008-002-000036',
      customer: 'Raju',
      garments: 18,
      expected: 18,
      status: 'COMPLETED',
      completedBy: 'raju',
    })
    expect(new Date(json.history[0].completedAt).toISOString()).toBe(COMPLETED_AT.toISOString())
  })

  it('reads completions ONLY — bagAssigned is the qualifying event', async () => {
    await history()
    expect(mocks.eventFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ businessId: 'lb1', action: 'SORTING_COMPLETE' }),
      orderBy: { createdAt: 'desc' },
    }))
    // The over-inclusive flag is not consulted at all.
    expect(mocks.packageFindMany).not.toHaveBeenCalled()
  })
})

describe('B/C · the bags shown are the ones actually assigned at Sorting', () => {
  it('shows the single Sorting bag', async () => {
    const { json } = await history()
    expect(json.history[0].sortingBags).toEqual(['VBBAG001'])
  })

  it('shows every Sorting bag, oldest first, never collapsed to one', async () => {
    mocks.assignmentFindMany.mockResolvedValue([
      row('VBBAG002', 'SORTING', '2026-08-30T11:00:00Z'),
      row('VBBAG001', 'SORTING', '2026-08-30T10:00:00Z'),
      row('VBBAG003', 'SORTING', '2026-08-30T12:00:00Z'),
    ])
    const { json } = await history()
    expect(json.history[0].sortingBags).toEqual(['VBBAG001', 'VBBAG002', 'VBBAG003'])
  })

  it('keeps a Sorting bag that has since been RELEASED — history is not the queue', async () => {
    // The operational reader drops closed rows so a released bag is never
    // offered as the bag to fill. History must not: it was still the bag.
    mocks.assignmentFindMany.mockResolvedValue([
      row('VBBAG001', 'SORTING', '2026-08-30T10:00:00Z', { status: 'RETURNED' }),
      row('VBBAG002', 'SORTING', '2026-08-30T11:00:00Z'),
    ])
    const { json } = await history()
    expect(json.history[0].sortingBags).toEqual(['VBBAG001', 'VBBAG002'])
  })
})

describe('G · a bag that was never a Sorting bag never appears as one', () => {
  it('excludes transport, delivery and unrecorded roles', async () => {
    mocks.assignmentFindMany.mockResolvedValue([
      row('VBBAG009', 'PICKUP', '2026-08-29T08:00:00Z'),
      row('VBBAG010', 'DELIVERY', '2026-08-31T08:00:00Z'),
      row('VBBAG011', null, '2026-08-29T09:00:00Z'),
      row('VBBAG001', 'SORTING', '2026-08-30T10:00:00Z'),
    ])
    const { json } = await history()
    expect(json.history[0].sortingBags).toEqual(['VBBAG001'])
  })

  it('an order completed with no recorded Sorting bag reports none, not a guess', async () => {
    mocks.assignmentFindMany.mockResolvedValue([row('VBBAG009', 'PICKUP', '2026-08-29T08:00:00Z')])
    const { json } = await history()
    expect(json.history[0].sortingBags).toEqual([])
  })

  it('the rule is the shared one, applied to the rows as given', () => {
    const rows: SortingBagRow[] = [
      { bagNumber: 'T1', purpose: 'PICKUP', open: true, assignedAt: '2026-08-29T08:00:00Z' },
      { bagNumber: 'S1', purpose: 'SORTING', open: false, assignedAt: '2026-08-30T10:00:00Z' },
      { bagNumber: 'S2', purpose: 'SORTING', open: true, assignedAt: '2026-08-30T11:00:00Z' },
    ]
    expect(sortingBagsEver(rows).map((b) => b.bagNumber)).toEqual(['S1', 'S2'])
  })
})

describe('D/E/F · nothing short of a completion gets in', () => {
  it('no completed package → empty History, whatever else happened', async () => {
    // A garment scanned, a panel opened, a bag assigned, a refused completion:
    // none of them flip bagAssigned, so the query returns nothing.
    mocks.eventFindMany.mockResolvedValue([])
    const { json } = await history()
    expect(json.history).toEqual([])
  })

  it('an order with Sorting bags but no completion is absent', async () => {
    mocks.eventFindMany.mockResolvedValue([])
    mocks.assignmentFindMany.mockResolvedValue([row('VBBAG001', 'SORTING', '2026-08-30T10:00:00Z')])
    const { json } = await history()
    expect(json.history).toEqual([])
  })

  it('History never writes — it is a read-only audit view', async () => {
    await history()
    // The only prisma calls are reads; no create/update/delete is even mocked,
    // so a write would throw rather than pass silently.
    expect(mocks.eventFindMany).toHaveBeenCalled()
    expect(mocks.assignmentFindMany).toHaveBeenCalled()
  })
})

describe('a bag bound WITHOUT completing the stage is not a completion', () => {
  it('/finishing-bag binding alone never reaches History', async () => {
    // That endpoint sets the same bagAssigned flag under the same gates but
    // never advances the garments, so the order is still at Sorting. Only the
    // completion event admits an order here, and it does not write one.
    mocks.eventFindMany.mockResolvedValue([])
    mocks.packageFindMany.mockResolvedValue([
      { id: 'pkg1', orderId: 'ord1', orderNumber: 'ORD-1', bagCode: 'VBBAG001', bagAssignedAt: COMPLETED_AT, bagAssignedBy: 'raju' },
    ])
    mocks.assignmentFindMany.mockResolvedValue([row('VBBAG001', 'SORTING', '2026-08-30T10:00:00Z')])
    const { json } = await history()
    expect(json.history).toEqual([])
  })
})

describe('exactly ONE record per completed order', () => {
  it('a repeated completion event collapses to one row', async () => {
    mocks.eventFindMany.mockResolvedValue([
      { orderId: 'ord1', createdAt: new Date('2026-08-30T13:00:00Z'), actorName: 'raju' },
      { orderId: 'ord1', createdAt: COMPLETED_AT, actorName: 'raju' },
    ])
    const { json } = await history()
    expect(json.history).toHaveLength(1)
    expect(json.history.filter((r: { orderId: string }) => r.orderId === 'ord1')).toHaveLength(1)
  })
})

describe('H · History is server-backed, so a refresh cannot change it', () => {
  it('two independent requests return the same completion', async () => {
    const a = await history()
    const b = await history()
    expect(a.json.history).toEqual(b.json.history)
    expect(b.json.history[0].orderNumber).toBe('ORD-STR-BUS-202608-0008-002-000036')
  })

  it('is tenant-scoped like every other read on this route', async () => {
    await history()
    expect(mocks.eventFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ businessId: 'lb1' }),
    }))
  })

  it('refuses without permission, like the rest of the endpoint', async () => {
    mocks.requireLaundryPermission.mockResolvedValue({ ok: false, res: new Response('no', { status: 403 }) })
    const res = await GET(new Request('http://t/api/laundry/processing/sorting?businessId=pb1&history=1'))
    expect(res.status).toBe(403)
    expect(mocks.eventFindMany).not.toHaveBeenCalled()
  })
})

describe('search finds an order by its number or by a bag it used', () => {
  it('resolves a bag number to the orders that used it at Sorting', async () => {
    await history('&search=VBBAG002')
    expect(mocks.assignmentFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ businessId: 'lb1', purpose: 'SORTING' }),
    }))
  })

  it('an unsearched listing does not run the bag lookup', async () => {
    await history()
    const bagLookup = mocks.assignmentFindMany.mock.calls.filter((c) => c[0]?.where?.bag)
    expect(bagLookup).toHaveLength(0)
  })
})

// ── I / J · the active workflow is untouched ────────────────────────────────
const SORT = readFileSync(join(process.cwd(), 'src/components/laundry/views/laundry-sorting-workstation.tsx'), 'utf8')
const UI = SORT.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s+\/\/.*$/gm, '')

describe('I/J · History sits beside the workflow, it does not replace it', () => {
  it('is a tab, defaulting to the active workstation', () => {
    expect(UI).toContain('useState<"active" | "history">("active")')
    expect(UI).toContain('[["active", "Active"], ["history", "History"]]')
  })

  it('the active workflow still owns BAG REQUIRED and the current bag', () => {
    expect(UI).toContain('BAG REQUIRED')
    // The banner still names the attached bag — in ONE phrase now, shared
    // word-for-word with the Complete Sorting card, instead of a second
    // sentence about the same fact plus an instruction.
    expect(UI).toContain('Sorting Bag{many ? "s" : ""} Attached')
    expect(UI).toContain('{status.attached.map((code) =>')
    expect(UI).toContain('Scan the next sorting bag')
    expect(UI).toContain('The following garments go into the bag you scan next.')
  })

  it('LAST 5 SCANS stays in the active tab and is not the History source', () => {
    expect(UI).toContain('SortingHistory businessId=')
    // History is fetched from the server, never derived from the scan aids.
    expect(UI).toContain('history: "1"')
    expect(UI).not.toMatch(/setRows\(\s*recent/)
  })

  it('History renders bags with a singular/plural label and no action', () => {
    expect(UI).toContain('"Sorting bag" : "Sorting bags"')
    expect(UI).toContain('COMPLETED — AUDIT VIEW')
  })
})
