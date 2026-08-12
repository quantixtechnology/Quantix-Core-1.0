import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const PICKUP_RECEIVE = read('src/app/api/laundry/bags/receive-at-store/route.ts')      // 1
const PC_RECEIVE = read('src/app/api/laundry/orders/[id]/receive/route.ts')            // 2
const STORE_RECEIVE = read('src/app/api/laundry/orders/[id]/store-receive/route.ts')   // 3
const DELIVERY_RETURN = read('src/app/api/laundry/bags/delivery-return/route.ts')      // 4
const DELIVER = read('src/lib/laundry-deliver.ts')
const ORDER_ADV = read('src/app/api/laundry/bags/order/[id]/advance/route.ts')

// Exactly four physical handovers release a bag.
describe('Test 1 — pickup bag released when the store receives it', () => {
  it('releases on receive', () => {
    expect(PICKUP_RECEIVE).toContain('releaseBagsForOrder(lbId, order.id)')
  })
  it('no longer just parks it at RECEIVED_AT_STORE', () => {
    expect(PICKUP_RECEIVE).not.toContain('data: { status: "RECEIVED_AT_STORE" } }).catch(() => null)')
  })
})

describe('Test 2 — Store → PC bag released when the PC receives it', () => {
  it('releases on receive', () => {
    expect(PC_RECEIVE).toContain('releaseBagsForOrder(order.businessId, order.id)')
  })
  it('reports the count so it cannot fail silently', () => {
    expect(PC_RECEIVE).toContain('bagsReleased')
  })
})

describe('Test 3 — PC → Store bag released when the store receives it', () => {
  it('releases instead of advancing to READY_FOR_DELIVERY', () => {
    expect(STORE_RECEIVE).toContain('releaseBagsForOrder(biz.id, order.id)')
    expect(STORE_RECEIVE).not.toContain('advanceBagsForOrder')
  })
})

describe('Test 4 — delivery bag released only when it comes back', () => {
  it('the return scan releases it', () => {
    expect(DELIVERY_RETURN).toMatch(/status: "AVAILABLE"/)
  })
  // Marking the order delivered means the customer has the clothes; the bag is
  // still in the van.
  it('marking delivered does NOT release it', () => {
    expect(DELIVER).not.toContain('releaseBagsForOrder')
    expect(DELIVER).toContain('the bag is still with the')
  })
})

// The rule that prevents every premature release.
describe('an order status change never releases a bag', () => {
  it('the order-advance route only releases on an explicit AVAILABLE', () => {
    expect(ORDER_ADV).toContain('if (toStatus === "AVAILABLE") {')
  })

  it('Store Audit approval (→ PROCESSING) does not release', () => {
    const guard = ORDER_ADV.slice(ORDER_ADV.indexOf('const toStatus'), ORDER_ADV.indexOf('const res = await prisma.laundryBag.updateMany'))
    expect(guard).not.toContain('PROCESSING')
    expect(guard).not.toContain('BAG_FREED')
  })

  it('READY_FOR_DELIVERY does not release the delivery bag', () => {
    const guard = ORDER_ADV.slice(ORDER_ADV.indexOf('const toStatus'), ORDER_ADV.indexOf('const res = await prisma.laundryBag.updateMany'))
    expect(guard).not.toContain('READY_FOR_DELIVERY')
  })

  it('the release-stage setting no longer gates any of the four', () => {
    for (const src of [PICKUP_RECEIVE, PC_RECEIVE, STORE_RECEIVE, ORDER_ADV, DELIVER]) {
      expect(src).not.toContain('getBagReleaseStage')
    }
  })

  it('a bag still in transit is never made available by this route', () => {
    expect(ORDER_ADV).not.toMatch(/IN_TRANSIT[^\n]*AVAILABLE/)
  })
})

describe('no new architecture', () => {
  it('every release goes through the one existing engine', () => {
    for (const src of [PICKUP_RECEIVE, PC_RECEIVE, STORE_RECEIVE]) {
      expect(src).toContain('from "@/lib/laundry-bag-assign"')
      expect(src).not.toContain('laundryBag.updateMany')
    }
  })

  it('no new bag model was introduced', () => {
    const schema = read('prisma/schema.prisma')
    expect(schema).not.toContain('model LaundryBagState')
    expect(schema).not.toContain('model LaundryBagLifecycle')
  })
})
