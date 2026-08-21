import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// ============================================================================
// Slice 3 — the Executive PWA.
//
// The executive is standing at a door. The whole bag model — custody, condition,
// history, ownership, inspection — stays in the backend, and the app asks them
// exactly one question: did the customer give you a bag, or not?
//
// The rule these tests exist to protect: A DELIVERY IS NEVER BLOCKED BY A BAG.
// ============================================================================

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const PWA = read('src/components/laundry/executive/executive-app.tsx')
const ASSIGN = read('src/app/api/laundry/executive/jobs/[id]/assign-bag/route.ts')
const DELIVER = read('src/app/api/laundry/executive/jobs/[id]/deliver/route.ts')
const LIFECYCLE = read('src/lib/laundry-bag-lifecycle.ts')

const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')
const PWA_TEXT = stripComments(PWA)

// ── Delivery (tests 1-5, §2 §16) ────────────────────────────────────────────
describe('delivery is never blocked by a bag', () => {
  it('the "scan the delivery bag first" gate is gone', () => {
    expect(PWA).not.toContain('Scan the delivery bag first')
    expect(PWA).not.toContain('Scan bag to start')
  })

  it('no readiness flag gates the delivery button any more', () => {
    expect(PWA).not.toContain('deliveryReady')
  })

  it('Confirm Delivery is disabled only while a request is in flight', () => {
    expect(PWA).toContain('disabled={busy} onClick={() => setDeliverOpen(true)}')
    expect(PWA).toContain('Confirm Delivery')
  })

  it('Navigate no longer requires a scanned bag', () => {
    const nav = PWA.slice(PWA.indexOf('const navigate = ()'), PWA.indexOf('const allBagsDone'))
    expect(nav).not.toContain('deliveryBagNumber')
  })

  it('the delivery bag card is optional and says so', () => {
    expect(PWA).toContain('optional')
    expect(PWA).toContain('you can deliver without it')
  })

  // The disposition still runs — it just cannot fail the delivery (Slice 1).
  it('the backend still records the handover, best-effort', () => {
    expect(DELIVER).toContain('applyDeliveryDisposition')
    expect(DELIVER).toContain('.catch(() => null)')
    expect(DELIVER).toContain('DEFAULT_DISPOSITION')
  })

  it('HANDED_TO_CUSTOMER remains the default outcome', () => {
    expect(LIFECYCLE).toContain('export const DEFAULT_DISPOSITION: Disposition = DISPOSITION.HANDED_TO_CUSTOMER')
  })

  it('a delivery with no bag at all is still a success', () => {
    expect(LIFECYCLE).toContain('// No bag on this delivery is a legitimate outcome, not an error.')
    expect(LIFECYCLE).toContain('disposition: DISPOSITION.NO_BAG_DELIVERED')
  })
})

// ── Pickup (tests 6-12, §5 §6 §9) ───────────────────────────────────────────
describe('pickup is two buttons', () => {
  it('offers exactly two scans: the returned bag, or a new one', () => {
    // Both are bags the executive is holding, so both are scanned. Picking a
    // bag on their behalf recorded a number nobody had read.
    expect(PWA).toContain('Scan Returned Bag')
    expect(PWA).toContain('Scan New Bag')
  })

  it('a failed scan falls through to a fallback, not to an error to resolve', () => {
    expect(PWA).toContain('Bag not readable')
    expect(PWA).toContain('else setFailed(true)')
    // The escape hatch is still one tap away — just no longer the default.
    expect(PWA).toContain('onUseNew(svc)')
  })

  it('Use New Bag always exists as the fallback', () => {
    expect(ASSIGN).toContain('const useNewBag = b.useNewBag === true')
    expect(ASSIGN).toContain('status: BAG_STATUS.AVAILABLE, active: true')
  })

  // Test 7 — a returned bag is HANDED_TO_CUSTOMER, so it must be taken back
  // before it can be attached to the new order.
  it('a returned bag is received first, then assigned to this order', () => {
    expect(ASSIGN).toContain('scanned?.status === BAG_STATUS.HANDED_TO_CUSTOMER')
    expect(ASSIGN).toContain('receiveReturnedBag')
    const receiveAt = ASSIGN.indexOf('receiveReturnedBag')
    const assignAt = ASSIGN.indexOf('assignBagToOrder({')
    expect(receiveAt).toBeLessThan(assignAt)
  })

  it('the executive is never asked to grade the bag', () => {
    expect(ASSIGN).toContain('condition: BAG_CONDITION.GOOD')
    for (const term of ['MINOR_DAMAGE', 'HEAVILY_DAMAGED', 'UNUSABLE']) {
      expect(PWA).not.toContain(term)
    }
  })

  it("another customer's bag quietly becomes Use New Bag", () => {
    expect(ASSIGN).toContain('useNewBag: true')
    // The executive is not shown the previous owner or asked to authorise.
    expect(PWA).not.toContain('previousCustomer')
    expect(PWA).not.toContain('authorizedBy')
  })

  // Test 12 — nothing in the app writes bag state itself.
  it('the app never manipulates bag lifecycle directly', () => {
    expect(PWA).not.toContain('/api/laundry/bags/customer-return')
    expect(PWA).not.toContain('/api/laundry/bags/identify')
    expect(PWA).not.toContain('HANDED_TO_CUSTOMER')
    // It calls the job endpoints; the domain does the rest.
    expect(PWA).toContain('/assign-bag')
  })
})

// ── §13 §19 — nothing that belongs to Admin leaks into the door ─────────────
describe('no admin concepts reach the executive', () => {
  it('shows no bag history, inventory, inspection or ownership UI', () => {
    for (const term of [
      'Inspection', 'Inventory', 'Bag History', 'Movement History', 'Usage History',
      'Custodian', 'Retired', 'Unclassified', 'cross-customer',
    ]) {
      expect(PWA_TEXT).not.toContain(term)
    }
  })

  it('uses plain words, not lifecycle vocabulary', () => {
    expect(PWA_TEXT).not.toMatch(/RETURNED_BY_CUSTOMER|INSPECTION_REQUIRED|custodianType/)
  })

  it('never tells the executive a bag is overdue, missing or the customer’s fault', () => {
    expect(PWA_TEXT).not.toMatch(/overdue|penalty|missing bag|return reminder/i)
  })
})

// ── §15 — the UI got simpler; the domain did not ────────────────────────────
describe('the backend stays fully accountable', () => {
  it('the receive still records custody, condition and an event', () => {
    expect(ASSIGN).toContain('receivedByCustodian: CUSTODIAN.DELIVERY_EXECUTIVE')
    expect(ASSIGN).toContain('Returned by customer at pickup')
    expect(ASSIGN).toContain('role: "DELIVERY_EXECUTIVE"')
  })

  it('lifecycle logic lives in the service, not in the route or the app', () => {
    // The route decides WHAT happened; the service decides what that means.
    expect(ASSIGN).not.toContain('conditionToStatus')
    expect(ASSIGN).not.toContain('laundryBagEvent')
    expect(ASSIGN).not.toContain('laundryBagAssignment')
  })

  it('the append-only history is untouched by this slice', () => {
    expect(LIFECYCLE).toContain('export async function receiveReturnedBag')
    expect(LIFECYCLE).toContain('recordBagEvent')
  })
})

// ── Regression (tests 13-16, §11 §21) ───────────────────────────────────────
describe('regression — everything else stays where it was', () => {
  it('pickup still completes through the existing confirm step', () => {
    expect(PWA).toContain('setStatus("PICKUP_COMPLETED")')
    expect(PWA).toContain('Confirm Pickup')
  })

  it('delivery still runs through the shared delivered engine', () => {
    expect(DELIVER).toContain('markOrderDelivered')
  })

  it('bag assignment still uses the shared engine, unchanged', () => {
    expect(ASSIGN).toContain('assignBagToOrder')
    expect(ASSIGN).toContain('logFieldEvent')
  })

  it('the pickup field-status safety rule is intact', () => {
    expect(ASSIGN).toContain('order.fieldStatus === "REACHED"')
    expect(ASSIGN).toContain('FIELD_STATUS.PICKUP_STARTED')
  })

  it('processing package and pickup-bag release are not touched here', () => {
    expect(ASSIGN).not.toContain('ProcessingPackage')
    expect(ASSIGN).not.toContain('releaseBagsForOrder')
    expect(ASSIGN).not.toContain('reusableBagReleaseStage')
  })
})
