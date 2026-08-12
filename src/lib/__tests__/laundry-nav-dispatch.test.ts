import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const NAV = read('src/lib/laundry-nav-config.ts')
const DISPATCH = read('src/app/api/laundry/dispatch/status/route.ts')

describe('the dispatch queue runs in promised order', () => {
  // createdAt sorts by when the order was TAKEN, which says nothing about when
  // it is due — the van leaves in slot order.
  it('sorts by promised date then promised slot', () => {
    expect(DISPATCH).toContain('{ promisedDeliveryDate: "asc" as const }, { promisedDeliveryTimeSlot: "asc" as const }')
  })

  it('no longer sorts the live queue by creation time', () => {
    expect(DISPATCH).not.toContain('orderBy: { createdAt: "desc" },')
  })

  it('history stays newest-first, as a log should', () => {
    expect(DISPATCH).toContain('scope === "history"')
    expect(DISPATCH).toContain('[{ createdAt: "desc" as const }]')
  })

  it('returns the promise fields it sorts on', () => {
    expect(DISPATCH).toContain('promisedDeliveryDate: true, promisedDeliveryTimeSlot: true')
  })
})

describe('Assign Bags is out of the default navigation', () => {
  it('is not offered as a default store-operations item', () => {
    expect(NAV).not.toContain('displayName: "Assign Bags"')
  })

  // Hidden, not deleted — the route mapping must survive so a tenant can add it
  // back through Navigation Manager.
  it('the screen is still routable', () => {
    expect(NAV).toContain('"store_ops.pickup_bags": "pickup-bags"')
  })

  it('the reason is recorded where the next person will look', () => {
    expect(NAV).toContain('1 order = 1 bag')
    expect(NAV).toContain('HIDDEN, NOT DELETED')
  })

  it('Bag Management stays — it is administration, not workflow', () => {
    expect(NAV).toContain('bag_management')
  })
})
