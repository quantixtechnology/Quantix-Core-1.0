import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// ============================================================================
// A GARMENT'S SERVICE IS PROOF THE SERVICE IS ON ITS ORDER.
//
// LaundryOrderService is written once, at order creation, and never updated.
// Store Audit can change a garment's service, or add a garment under another
// one — both write LaundryOrderItem.serviceId and leave the declared list
// behind. Sorting sends the GARMENT's service, the declared list did not
// contain it, and a perfectly good available bag was refused with "That service
// is not on this order", blocking the stage with nothing the operator could fix.
//
// The bag was never even looked at: pickServiceForBag runs before
// addBagToOrder, which is why the screen called it a WRONG BAG.
//
// The one-service rule already reads services OR items for this exact reason.
// This brings the bag rule to the same source — for an EXPLICITLY named service
// only, so callers that send none (the shared bag panel, Store Stages) keep
// today's behaviour and are never shown a choice they cannot render.
// ============================================================================

const mocks = vi.hoisted(() => ({
  orderFindFirst: vi.fn(),
  itemFindFirst: vi.fn(),
  requireLaundryPermission: vi.fn(),
  orderBags: vi.fn(),
  addBagToOrder: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: { laundryOrder: { findFirst: mocks.orderFindFirst }, laundryOrderItem: { findFirst: mocks.itemFindFirst } },
}))
vi.mock('@/lib/laundry-business', () => ({
  resolveLaundryBusiness: vi.fn(async () => ({ id: 'lb1', platformBusinessId: 'pb1', businessCode: 'BUS-1' })),
}))
vi.mock('@/lib/laundry-rbac', () => ({ requireLaundryPermission: mocks.requireLaundryPermission }))
vi.mock('@/lib/laundry-order-bags', () => ({ orderBags: mocks.orderBags, addBagToOrder: mocks.addBagToOrder }))

import { POST } from '@/app/api/laundry/orders/[id]/bags/route'

const SVC_A = { serviceId: 'svc_a', serviceName: 'Wash & Fold', requiredBags: 1 }
const SVC_B = { serviceId: 'svc_b', serviceName: 'Dry Clean', requiredBags: 1 }

const post = async (body: Record<string, unknown>) => {
  const res = await POST(
    new Request('http://t/api/laundry/orders/ord1/bags', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessId: 'pb1', code: 'VBBAG086', ...body }),
    }),
    { params: Promise.resolve({ id: 'ord1' }) },
  )
  // The handler always answers; a missing response is a real failure, not a
  // case to type around.
  if (!res) throw new Error('route returned no response')
  return res
}

/** The order as the route reads it: only its DECLARED services. */
const givenOrder = (declared: typeof SVC_A[]) =>
  mocks.orderFindFirst.mockResolvedValue({ id: 'ord1', orderNumber: 'ORD-…-000054', services: declared })

/** What the order's GARMENTS actually carry. */
const givenGarmentServices = (ids: string[]) =>
  mocks.itemFindFirst.mockImplementation(async (a: { where: { serviceId: string } }) =>
    ids.includes(a.where.serviceId)
      ? { serviceId: a.where.serviceId, serviceName: a.where.serviceId === 'svc_b' ? 'Dry Clean' : 'Wash & Fold' }
      : null)

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireLaundryPermission.mockResolvedValue({ ok: true })
  mocks.orderBags.mockResolvedValue([])
  mocks.addBagToOrder.mockResolvedValue({ ok: true, bag: { bagId: 'b1', bagNumber: 'VBBAG086' }, total: 1, alreadyOnOrder: false })
  givenGarmentServices([])
})

describe('A · the garment’s service is missing from the declared list', () => {
  it('the bag is assigned, to the service the garment actually carries', async () => {
    givenOrder([SVC_A])              // declared: Wash & Fold only
    givenGarmentServices(['svc_b'])  // a garment carries Dry Clean
    const res = await post({ serviceId: 'svc_b' })
    expect(res.status).toBe(200)
    expect(mocks.addBagToOrder).toHaveBeenCalledWith(expect.objectContaining({
      orderId: 'ord1', code: 'VBBAG086', serviceId: 'svc_b', serviceName: 'Dry Clean',
    }))
  })

  it('the garment lookup is scoped to THIS order', async () => {
    givenOrder([SVC_A]); givenGarmentServices(['svc_b'])
    await post({ serviceId: 'svc_b' })
    expect(mocks.itemFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ orderId: 'ord1', serviceId: 'svc_b' }),
    }))
  })
})

describe('B · a normal single-service order is unchanged', () => {
  it('declared service, same garment service → assigned, no extra lookup', async () => {
    givenOrder([SVC_A])
    const res = await post({ serviceId: 'svc_a' })
    expect(res.status).toBe(200)
    // Already declared, so the garment table is never consulted.
    expect(mocks.itemFindFirst).not.toHaveBeenCalled()
    expect(mocks.addBagToOrder).toHaveBeenCalledWith(expect.objectContaining({ serviceId: 'svc_a' }))
  })

  it('no serviceId on a single-service order still picks it', async () => {
    givenOrder([SVC_A])
    const res = await post({})
    expect(res.status).toBe(200)
    expect(mocks.addBagToOrder).toHaveBeenCalledWith(expect.objectContaining({ serviceId: 'svc_a' }))
  })
})

describe('C · a multi-service order files the bag under the named service', () => {
  it('picks the one asked for', async () => {
    givenOrder([SVC_A, SVC_B])
    const res = await post({ serviceId: 'svc_b' })
    expect(res.status).toBe(200)
    expect(mocks.addBagToOrder).toHaveBeenCalledWith(expect.objectContaining({ serviceId: 'svc_b', serviceName: 'Dry Clean' }))
  })
})

describe('D · a genuinely ambiguous order still asks the operator', () => {
  it('two declared services and no serviceId → refused, never guessed', async () => {
    givenOrder([SVC_A, SVC_B])
    const res = await post({})
    const j = await res.json()
    expect(res.status).toBe(400)
    expect(j.code).toBe('SERVICE_REQUIRED')
    expect(j.error).toContain('choose which one')
    expect(mocks.addBagToOrder).not.toHaveBeenCalled()
  })

  it('a caller that sends no serviceId never triggers the garment lookup', async () => {
    // The shared bag panel and Store Stages send none and cannot render a
    // choice — their behaviour must be exactly what it was.
    givenOrder([SVC_A, SVC_B]); givenGarmentServices(['svc_a', 'svc_b'])
    await post({})
    expect(mocks.itemFindFirst).not.toHaveBeenCalled()
  })
})

describe('E · a service on neither the order nor its garments is still refused', () => {
  it('rejected exactly as before', async () => {
    givenOrder([SVC_A])
    givenGarmentServices(['svc_a'])   // svc_x is on nothing
    const res = await post({ serviceId: 'svc_x' })
    const j = await res.json()
    expect(res.status).toBe(400)
    expect(j.code).toBe('SERVICE_REQUIRED')
    expect(j.error).toBe('That service is not on this order.')
    expect(mocks.addBagToOrder).not.toHaveBeenCalled()
  })

  it('another order’s service cannot make a bag eligible', async () => {
    // The lookup is filtered by orderId, so a service used elsewhere finds
    // nothing here and the refusal stands.
    givenOrder([SVC_A])
    mocks.itemFindFirst.mockResolvedValue(null)
    const res = await post({ serviceId: 'svc_b' })
    expect(res.status).toBe(400)
    expect(mocks.addBagToOrder).not.toHaveBeenCalled()
  })
})

describe('F/G/H · every existing bag rule is still the bag writer’s', () => {
  it('a released bag reused elsewhere is accepted by the single writer', async () => {
    givenOrder([SVC_A])
    const res = await post({ serviceId: 'svc_a' })
    expect(res.status).toBe(200)   // nothing here inspects history
  })

  it('a cross-business or held bag is still refused, with its own status', async () => {
    givenOrder([SVC_A])
    mocks.addBagToOrder.mockResolvedValue({ ok: false, status: 404, error: 'Bag not found.' })
    const res = await post({ serviceId: 'svc_a' })
    expect(res.status).toBe(404)
  })

  it('a concurrent grab still surfaces the writer’s 409', async () => {
    givenOrder([SVC_A])
    mocks.addBagToOrder.mockResolvedValue({ ok: false, status: 409, error: 'Bag was taken by another assignment.' })
    const res = await post({ serviceId: 'svc_a' })
    expect(res.status).toBe(409)
    expect((await res.json()).error).toContain('taken by another assignment')
  })

  it('the route decides no bag rule of its own', () => {
    const ROUTE = readFileSync(join(process.cwd(), 'src/app/api/laundry/orders/[id]/bags/route.ts'), 'utf8')
    const added = ROUTE.slice(ROUTE.indexOf("A GARMENT'S SERVICE IS PROOF"), ROUTE.indexOf('const pick = pickServiceForBag'))
    for (const w of ['status', 'AVAILABLE', 'laundryBag', 'purpose', 'custodian']) expect(added, w).not.toContain(w)
  })
})

describe('I · the screen names the right problem', () => {
  const UI = readFileSync(join(process.cwd(), 'src/components/laundry/views/laundry-sorting-workstation.tsx'), 'utf8')

  it('a SERVICE_REQUIRED refusal is not called a wrong bag', () => {
    expect(UI).toContain(`kind: j?.code === "SERVICE_REQUIRED" ? "SERVICE" : "BAG"`)
    expect(UI).toContain('⚠ Service required')
    // Now rendered on the order the refusal names, but still its OWN branch:
    // a service problem must not be dressed up as a wrong bag.
    expect(UI).toContain('{wrongBag?.orderNumber === o.orderNumber && wrongBag.kind === "SERVICE" && (')
  })

  it('and says the bag itself was fine', () => {
    expect(UI).toContain('was not changed — choose the service this bag is for and scan it again.')
  })

  it('a genuine wrong bag keeps its own warning, unchanged', () => {
    expect(UI).toContain('{wrongBag?.orderNumber === o.orderNumber && wrongBag.kind === "BAG" && (')
    expect(UI).toContain('✗ Wrong bag')
    expect(UI).toContain('Nothing was changed — both bags keep their orders, and the garment count is unaffected.')
  })
})
