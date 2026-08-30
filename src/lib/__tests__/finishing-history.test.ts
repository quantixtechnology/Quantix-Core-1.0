import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// ============================================================================
// IRONING / FOLDING HISTORY — what was actually completed at the stage.
//
// Additive and read-only. The live Active path — scan a bag → resolve the
// container → packageGarmentsWhere → load the batch — is NOT touched: the
// history branch returns before any of it, and no garment barcode becomes
// required at either stage.
//
// THE QUALIFYING RECORD is the existing per-garment completion,
// LaundryItemEvent { action: "COMPLETE", stage: IRON|FOLD }, written only by
// /api/laundry/items/[id]/process. Scanning a bag, loading a container and
// opening a batch write no such event, so none of them can appear here.
//
// A row is one CONTAINER, named by the code the operator actually scans. Which
// individual SORTING bag a garment went into is deliberately absent: that
// relationship is not stored, and this suite pins that it is never invented.
// ============================================================================

const mocks = vi.hoisted(() => ({
  itemEventFindMany: vi.fn(),
  itemFindMany: vi.fn(),
  orderFindMany: vi.fn(),
  packageFindMany: vi.fn(),
  customerFindMany: vi.fn(),
  bizFindUnique: vi.fn(),
  requireLaundryPermission: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    laundryItemEvent: { findMany: mocks.itemEventFindMany },
    laundryOrderItem: { findMany: mocks.itemFindMany },
    laundryOrder: { findMany: mocks.orderFindMany, findUnique: vi.fn() },
    laundryProcessingPackage: { findMany: mocks.packageFindMany, findFirst: vi.fn() },
    customer: { findMany: mocks.customerFindMany },
    laundryBusiness: { findUnique: mocks.bizFindUnique },
  },
}))
vi.mock('@/lib/laundry-business', () => ({
  resolveLaundryBusiness: vi.fn(async () => ({ id: 'lb1', platformBusinessId: 'pb1', businessCode: 'BUS-1' })),
}))
vi.mock('@/lib/laundry-rbac', () => ({ requireLaundryPermission: mocks.requireLaundryPermission }))

import { GET } from '@/app/api/laundry/processing/finishing/route'

const AT = (iso: string) => new Date(iso)
const hist = async (stage = 'IRON', qs = '') => {
  const res = await GET(new Request(`http://t/api/laundry/processing/finishing?businessId=pb1&stage=${stage}&history=1${qs}`))
  return { res, json: await res.json() }
}

const item = (id: string, name: string, serviceId: string | null = 'svc1') =>
  ({ id, garmentName: name, serviceId, serviceName: 'Wash & Iron', orderId: 'ord1' })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireLaundryPermission.mockResolvedValue({ ok: true })
  mocks.bizFindUnique.mockResolvedValue({ processingPackageQrMode: 'GENERATE_NEW', workstationScanSound: true })
  mocks.itemEventFindMany.mockResolvedValue([
    { itemId: 'i1', orderId: 'ord1', actorName: 'raju', createdAt: AT('2026-08-30T06:30:00Z') },
    { itemId: 'i2', orderId: 'ord1', actorName: 'raju', createdAt: AT('2026-08-30T06:29:00Z') },
    { itemId: 'i3', orderId: 'ord1', actorName: 'raju', createdAt: AT('2026-08-30T06:28:00Z') },
  ])
  mocks.itemFindMany.mockResolvedValue([item('i1', 'Shirt'), item('i2', 'Shirt'), item('i3', 'Jeans')])
  mocks.orderFindMany.mockResolvedValue([
    { id: 'ord1', orderNumber: 'ORD-STR-BUS-202608-0008-002-000036', status: 'IN_PROCESSING', customerId: 'c1' },
  ])
  mocks.packageFindMany.mockResolvedValue([{ id: 'pkg1', code: 'PKG-1', bagCode: 'VBBAG001', orderId: 'ord1', serviceId: 'svc1' }])
  mocks.customerFindMany.mockResolvedValue([{ id: 'c1', name: 'Raju' }])
})

describe('3/4 · a successful completion appears in the right stage History', () => {
  it('Ironing reads COMPLETE events at IRON', async () => {
    const { res, json } = await hist('IRON')
    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(mocks.itemEventFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ businessId: 'lb1', action: 'COMPLETE', stage: 'IRON' }),
    }))
    expect(json.history[0]).toMatchObject({
      orderNumber: 'ORD-STR-BUS-202608-0008-002-000036',
      customer: 'Raju', container: 'VBBAG001', garments: 3, status: 'COMPLETED', stage: 'IRON',
    })
  })

  it('Folding reads COMPLETE events at FOLD', async () => {
    await hist('FOLD')
    expect(mocks.itemEventFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ action: 'COMPLETE', stage: 'FOLD' }),
    }))
  })

  it('reports the garment types actually completed', async () => {
    const { json } = await hist()
    expect(json.history[0].contents).toEqual([{ name: 'Shirt', count: 2 }, { name: 'Jeans', count: 1 }])
  })

  it('records when it was completed and by whom', async () => {
    const { json } = await hist()
    expect(new Date(json.history[0].completedAt).toISOString()).toBe('2026-08-30T06:30:00.000Z')
    expect(json.history[0].completedBy).toBe('raju')
  })
})

describe('5/6/7 · nothing short of a completion gets in', () => {
  it('no COMPLETE events → empty History, whatever was scanned or loaded', async () => {
    // Scanning a bag, loading a container and opening a batch write no
    // LaundryItemEvent COMPLETE, so the query simply returns nothing.
    mocks.itemEventFindMany.mockResolvedValue([])
    const { json } = await hist()
    expect(json.history).toEqual([])
  })

  it('only the COMPLETE action qualifies — never START, SCAN or QC', async () => {
    await hist()
    const where = mocks.itemEventFindMany.mock.calls[0][0].where
    expect(where.action).toBe('COMPLETE')
  })

  it('a re-completed garment is still ONE garment', async () => {
    mocks.itemEventFindMany.mockResolvedValue([
      { itemId: 'i1', orderId: 'ord1', actorName: 'raju', createdAt: AT('2026-08-30T07:00:00Z') },
      { itemId: 'i1', orderId: 'ord1', actorName: 'raju', createdAt: AT('2026-08-30T06:30:00Z') },
    ])
    mocks.itemFindMany.mockResolvedValue([item('i1', 'Shirt')])
    const { json } = await hist()
    expect(json.history[0].garments).toBe(1)
    expect(json.history[0].contents).toEqual([{ name: 'Shirt', count: 1 }])
  })
})

describe('the container is reported, never the Sorting bag guessed', () => {
  it('names the container code the operator actually scans', async () => {
    const { json } = await hist()
    expect(json.history[0].container).toBe('VBBAG001') // package.bagCode
  })

  it('falls back to the package code when no bag code was recorded', async () => {
    mocks.packageFindMany.mockResolvedValue([{ id: 'pkg1', code: 'PKG-1', bagCode: null, orderId: 'ord1', serviceId: 'svc1' }])
    const { json } = await hist()
    expect(json.history[0].container).toBe('PKG-1')
  })

  it('says nothing rather than guessing when the order has no container', async () => {
    mocks.packageFindMany.mockResolvedValue([])
    const { json } = await hist()
    expect(json.history[0].container).toBeNull()
    expect(json.history[0].garments).toBe(3)
  })

  it('never reports a Sorting bag number — that membership is not stored', async () => {
    const { json } = await hist()
    expect(Object.keys(json.history[0])).not.toContain('sortingBags')
    expect(JSON.stringify(json.history)).not.toContain('VBBAG002')
  })

  it('service-scoped containers keep their own garments apart', async () => {
    mocks.itemEventFindMany.mockResolvedValue([
      { itemId: 'i1', orderId: 'ord1', actorName: 'a', createdAt: AT('2026-08-30T06:30:00Z') },
      { itemId: 'i9', orderId: 'ord1', actorName: 'a', createdAt: AT('2026-08-30T06:20:00Z') },
    ])
    mocks.itemFindMany.mockResolvedValue([item('i1', 'Shirt', 'svc1'), item('i9', 'Blanket', 'svc2')])
    mocks.packageFindMany.mockResolvedValue([
      { id: 'pkgA', code: 'PKG-A', bagCode: 'VBBAG001', orderId: 'ord1', serviceId: 'svc1' },
      { id: 'pkgB', code: 'PKG-B', bagCode: 'VBBAG002', orderId: 'ord1', serviceId: 'svc2' },
    ])
    const { json } = await hist()
    expect(json.history).toHaveLength(2)
    const byContainer = Object.fromEntries(json.history.map((r: { container: string; garments: number }) => [r.container, r.garments]))
    expect(byContainer).toEqual({ VBBAG001: 1, VBBAG002: 1 })
  })
})

describe('8/9 · server-backed, tenant-scoped, permission-gated', () => {
  it('two identical requests return the same history — a refresh changes nothing', async () => {
    const a = await hist(); const b = await hist()
    expect(a.json.history).toEqual(b.json.history)
  })

  it('is scoped to the tenant', async () => {
    await hist()
    expect(mocks.itemEventFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ businessId: 'lb1' }),
    }))
  })

  it('honours the existing per-stage permission guard', async () => {
    mocks.requireLaundryPermission.mockResolvedValue({ ok: false, res: new Response('no', { status: 403 }) })
    const res = await GET(new Request('http://t/api/laundry/processing/finishing?businessId=pb1&stage=IRON&history=1'))
    expect(res.status).toBe(403)
    expect(mocks.itemEventFindMany).not.toHaveBeenCalled()
  })

  it('an event whose order belongs to another tenant is dropped', async () => {
    mocks.orderFindMany.mockResolvedValue([])
    const { json } = await hist()
    expect(json.history).toEqual([])
  })

  it('searches by order number or container', async () => {
    expect((await hist('IRON', '&search=VBBAG001')).json.history).toHaveLength(1)
    expect((await hist('IRON', '&search=000036')).json.history).toHaveLength(1)
    expect((await hist('IRON', '&search=NOPE')).json.history).toHaveLength(0)
  })
})

// ── 1/2/12/13/14 · the live path is untouched ───────────────────────────────
const ROUTE = readFileSync(join(process.cwd(), 'src/app/api/laundry/processing/finishing/route.ts'), 'utf8')
const FIN = readFileSync(join(process.cwd(), 'src/lib/laundry-finishing.ts'), 'utf8')
const UI = readFileSync(join(process.cwd(), 'src/components/laundry/views/laundry-finishing-workstation.tsx'), 'utf8')

describe('1/2/14 · the Active load path is not changed', () => {
  it('history returns BEFORE any container resolution', () => {
    const historyAt = ROUTE.indexOf('if (sp.get("history"))')
    expect(historyAt).toBeGreaterThan(-1)
    expect(historyAt).toBeLessThan(ROUTE.indexOf('const code = (sp.get("code")'))
    expect(historyAt).toBeLessThan(ROUTE.indexOf('// ── Resolve a scanned / selected container'))
  })

  it('packageGarmentsWhere is untouched — still order/service scoped', () => {
    expect(FIN).toContain('return pkg.serviceId ? { orderId: pkg.orderId, serviceId: pkg.serviceId } : { orderId: pkg.orderId }')
  })

  it('the history branch never calls the loader helper', () => {
    const branch = ROUTE.slice(ROUTE.indexOf('if (sp.get("history"))'), ROUTE.indexOf('const settings = await prisma.laundryBusiness'))
    expect(branch).not.toContain('packageGarmentsWhere')
    expect(branch).not.toContain('bagAtTime')
    for (const w of ['create(', 'update(', 'updateMany(', 'delete(', 'upsert(']) expect(branch, w).not.toContain(w)
  })

  it('Active is still the default tab and still renders the scan + load surface', () => {
    expect(UI).toContain('useState<"active" | "history">("active")')
    expect(UI).toContain('Load Container')
    expect(UI).toContain('{tab === "active" && (<>')
  })
})

describe('12/13 · no garment barcode is required at Ironing or Folding', () => {
  it('the stage still scans the container, not a garment', () => {
    expect(UI).toContain('Garment barcode scanning ended at Sorting.')
    expect(UI).toContain('to load the whole bag/container and process it in place.')
  })

  it('history adds no garment-code scanning of its own', () => {
    const comp = UI.slice(UI.indexOf('function FinishingHistory'), UI.indexOf('export function LaundryFinishingWorkstation'))
    for (const w of ['garmentScanCode', 'barcode', 'GARCODE']) expect(comp, w).not.toContain(w)
  })
})
