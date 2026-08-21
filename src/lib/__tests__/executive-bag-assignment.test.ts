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

describe('a bag is identified by its QR, never by availability', () => {
  it('both paths open the scanner', () => {
    expect(UI).toContain('label="Scan Existing Bag"')
    expect(UI).toContain('label="Tag New Bag"')
  })

  it('the app offers no way to assign without scanning', () => {
    expect(UI).not.toContain('useNewBag')
    expect(UI).not.toContain('assign any spare bag')
  })

  it('the SERVER refuses an assignment with no scanned code', () => {
    // The guard cannot live only in the app: a client that forgets to scan
    // must be refused, not accommodated.
    expect(ROUTE).toContain("if (!code) {")
    expect(ROUTE).toContain("Scan the bag's QR code")
  })

  it('the auto-pick is gone from the server, not just hidden', () => {
    // "find next AVAILABLE and assign" is what recorded a bag nobody held.
    expect(ROUTE).not.toContain('b.useNewBag === true')
    expect(ROUTE).not.toContain('orderBy: { bagNumber: "asc" }')
  })

  it('the entry point invites a scan', () => {
    expect(UI).toContain('Add / Scan Bag')
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

  it('it locks on CONFIRMATION, not on customer verification', () => {
    // pickupVerifiedAt is stamped when the customer proves who they are, at
    // REACHED — BEFORE any bag is scanned. Gating on it locked the bag list at
    // the moment the executive started filling it, so the remove button was
    // refused on the very screen that exists to edit bags.
    expect(ROUTE).toContain('if (order.pickupCompletedAt)')
    const del = ROUTE.slice(ROUTE.indexOf('export async function DELETE'))
    expect(del).not.toContain('if (order.pickupVerifiedAt)')
    expect(ROUTE).toContain('Pickup is already confirmed')
  })

  it('the control is hidden exactly when the API would refuse it', () => {
    // A visible button that the server rejects is worse than no button.
    expect(UI).toContain('const pickupDone = st >= RANK.PICKUP_COMPLETED')
    expect(UI).toContain('st >= RANK.PICKUP_STARTED && !pickupDone')
  })

  it('removal frees the bag instead of consuming it', () => {
    const ASSIGN_LIB = read('src/lib/laundry-bag-assign.ts')
    expect(ASSIGN_LIB).toContain('status: "AVAILABLE"')
    expect(ASSIGN_LIB).toContain('currentOrderId: null')
    // The physical bag record is UPDATED, never deleted.
    expect(ASSIGN_LIB).not.toContain('laundryBag.delete')
    expect(ASSIGN_LIB).toContain('status: "RETURNED", returnedAt: now')
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
