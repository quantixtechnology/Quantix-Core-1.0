import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// ============================================================================
// The bag on the record must be the bag in the van.
//
// "Use New Bag" used to pick the lowest-numbered AVAILABLE bag on the
// executive's behalf. It guaranteed the pickup completed, but it recorded a bag
// nobody had scanned — so an executive carrying BAG-000047 could leave a
// doorstep with BAG-000001 attached to the order, and every later step (store
// receive, audit, processing, return) trusted that record.
//
// A new bag is still a bag the executive is holding, so it is scanned like any
// other. Auto-pick survives only behind a failed scan, so a doorstep is never a
// dead end — but it is no longer what happens by default.
// ============================================================================

const ROOT = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

const UI = read('src/components/laundry/executive/executive-app.tsx')
const ROUTE = read('src/app/api/laundry/executive/jobs/[id]/assign-bag/route.ts')

describe('a new bag is scanned, not guessed', () => {
  it('the new-bag action opens the scanner', () => {
    expect(UI).toContain('label="Scan New Bag"')
  })

  it('auto-pick is only offered after a scan has failed', () => {
    // It sits inside the `failed` branch, not beside the scan button.
    const block = UI.slice(UI.indexOf('{failed && ('), UI.indexOf('{failed && (') + 900)
    expect(block).toContain('onUseNew(svc)')
    expect(block).toContain("Can&apos;t scan")
  })

  it('the server still has the escape hatch, unchanged', () => {
    // Removing it would recreate the doorstep dead end it exists to prevent.
    expect(ROUTE).toContain('const useNewBag = b.useNewBag === true')
    expect(ROUTE).toContain('status: BAG_STATUS.AVAILABLE')
  })
})

describe('a bag can be taken back off an unconfirmed pickup', () => {
  it('there is a remove action per assigned bag', () => {
    expect(UI).toContain('onRemove(svc, bn)')
    expect(UI).toContain('aria-label={`Remove ${bn}`}')
  })

  it('removal goes through the audited release, not a raw update', () => {
    // The release is recorded, never erased.
    expect(ROUTE).toContain('releaseBagWithAudit({')
    expect(ROUTE).toContain('releaseType: "MANUAL"')
    expect(ROUTE).toContain('reason: "Removed by executive before pickup was confirmed"')
  })

  it('it refuses once the pickup is confirmed', () => {
    // After verification the bag list is history, not a choice.
    expect(ROUTE).toContain('if (order.pickupVerifiedAt)')
    expect(ROUTE).toContain('Pickup is already confirmed')
  })

  it('an executive can only touch their own pickup', () => {
    const del = ROUTE.slice(ROUTE.indexOf('export async function DELETE'))
    expect(del).toContain('order.pickupExecutiveId !== session.executiveId')
  })

  it('and only a bag that is actually on this order', () => {
    const del = ROUTE.slice(ROUTE.indexOf('export async function DELETE'))
    expect(del).toContain('currentOrderId: order.id')
    expect(del).toContain('That bag is not on this pickup.')
  })

  it('the removal is written to the order timeline', () => {
    expect(ROUTE).toContain('action: "BAG_REMOVED"')
  })
})
