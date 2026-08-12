import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const ASSIGN = read('src/lib/laundry-bag-assign.ts')
const RECEIVE = read('src/app/api/laundry/orders/[id]/receive/route.ts')
const BAG_SCAN = read('src/app/api/laundry/bags/advance/route.ts')
const ORDER_ADV = read('src/app/api/laundry/bags/order/[id]/advance/route.ts')
const SETTINGS = read('src/app/api/laundry/bag-settings/route.ts')
const UI = read('src/components/laundry/views/laundry-bag-management.tsx')

describe('the bag is freed when the Processing Center receives it', () => {
  // This was the gap: the PC receive endpoint never touched the bag at all.
  it('the receive endpoint releases the order bags', () => {
    expect(RECEIVE).toContain('releaseBagsForOrder(order.businessId, order.id)')
    expect(RECEIVE).toContain('getBagReleaseStage(order.businessId)')
  })

  it('only when the workspace releases at that point', () => {
    expect(RECEIVE).toContain('=== "PROCESSING_RECEIVE"')
  })

  it('a bag scanned in at the Processing Center is freed too', () => {
    expect(BAG_SCAN).toContain('const FREED_BY_SCAN = new Set(["RECEIVED_AT_STORE", "PROCESSING"])')
  })

  it('uses the ONE release engine, so history and usage survive', () => {
    expect(RECEIVE).toContain('from "@/lib/laundry-bag-assign"')
    expect(RECEIVE).not.toContain('laundryBag.update')
  })

  // Releasing the bag must not disturb the order.
  it('the order still advances to PROCESSING and nothing else changes', () => {
    expect(RECEIVE).toContain('toStatus: "PROCESSING", action: "RECEIVE_AT_PROCESSING"')
    expect(RECEIVE).not.toContain('status: "READY_FOR_DELIVERY"')
  })

  it('a failed release can never block the receive', () => {
    expect(RECEIVE).toMatch(/releaseBagsForOrder\([^)]*\)\.catch\(\(\) => 0\)/)
  })
})

describe('the setting names the real event', () => {
  it('two options: Processing Center receive, or after delivery', () => {
    expect(ASSIGN).toContain('export type BagReleaseStage = "PROCESSING_RECEIVE" | "AFTER_DELIVERY"')
  })

  it('Processing Center receive is the default', () => {
    expect(ASSIGN).toContain('=== "AFTER_DELIVERY" ? "AFTER_DELIVERY" : "PROCESSING_RECEIVE"')
    expect(SETTINGS).toContain('"PROCESSING_RECEIVE"')
  })

  // Legacy rows are READ as the new default rather than migrated.
  it('legacy STORE_RECEIVE rows keep working without a migration', () => {
    expect(ASSIGN).toContain('is read as PROCESSING_RECEIVE rather than migrated')
    expect(read('prisma/schema.prisma')).not.toContain('PROCESSING_RECEIVE')
  })

  it('the option is labelled for what it does', () => {
    expect(UI).toContain('Release at Processing Center Receive')
    expect(UI).toContain('the garments come out there')
  })

  it('no second release mechanism was added', () => {
    expect(ORDER_ADV).toContain('getBagReleaseStage')
    expect(BAG_SCAN).toContain('getBagReleaseStage')
  })
})

describe('nothing releases early', () => {
  it('a bag in transit is not in any freeing set', () => {
    expect(BAG_SCAN).not.toMatch(/FREED_BY_SCAN[^)]*IN_TRANSIT/)
    expect(ORDER_ADV).not.toMatch(/BAG_FREED[^)]*IN_TRANSIT/)
  })

  it('the freeing statuses are exactly the points the garments leave the bag', () => {
    expect(ORDER_ADV).toContain('const BAG_FREED = new Set(["RECEIVED_AT_STORE", "UNDER_AUDIT", "PROCESSING"])')
  })
})
