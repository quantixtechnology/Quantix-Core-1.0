import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { TRANSITIONS, getTransition, statusLabel } from '@/lib/laundry-workflow'

// ============================================================================
// STORE AUDIT → "Approve & Generate Invoice" → 409.
//
// TWO defects, neither of them the audit gate itself:
//
//  1. The route's two 409s had DIFFERENT shapes. An invalid transition answers
//     { error }, the audit gate answers { success:false, code, message,
//     expected, audited } — no `error` key. The screen read only json.error, so
//     a precise refusal ("2 of 5 garments inspected") arrived as a bare
//     "Transition failed" and the operator saw an unexplained 409.
//
//  2. transition() discarded saveInspection()'s result. Saving the inspection is
//     what stamps garments as inspected AND writes the KG invoice figures, so a
//     failed save guaranteed the gate would refuse — leaving exactly the
//     "invoice attempted, order stuck" state.
//
// The gate is NOT removed. An order still cannot leave Store Audit with
// un-inspected garments; it now says which ones.
// ============================================================================

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const ROUTE = read('src/app/api/laundry/orders/[id]/transition/route.ts')
const AUDIT = read('src/components/laundry/views/laundry-store-audit.tsx')

describe('the approval targets the real workflow edge', () => {
  it('Approve & Generate Invoice sends PAYMENT_PENDING', () => {
    expect(AUDIT).toContain('transition("PAYMENT_PENDING", "Audit Approved")')
    expect(AUDIT).toContain('Approve & Generate Invoice')
  })

  it('PENDING_STORE_AUDIT → PAYMENT_PENDING is APPROVE_AUDIT and is allowed', () => {
    const t = getTransition('PENDING_STORE_AUDIT', 'PAYMENT_PENDING')
    expect(t?.action).toBe('APPROVE_AUDIT')
    expect(t?.internal).toBeFalsy() // the generic endpoint may perform it
  })

  it('an order held UNDER_AUDIT can still be approved', () => {
    expect(getTransition('UNDER_AUDIT', 'PAYMENT_PENDING')?.action).toBe('COMPLETE_AUDIT')
  })
})

// ── CASE A · Pay Later must not block the approval ─────────────────────────
describe('CASE A · Pay Later does not block Store Audit approval', () => {
  it('the transition route has NO payment guard at all', () => {
    expect(ROUTE).not.toContain('balanceDue')
    expect(ROUTE).not.toContain('paymentStatus')
    expect(ROUTE).not.toContain('amountPaid')
    expect(ROUTE).not.toContain('PAY_LATER')
  })

  it('the only gate on approval is the audit gate', () => {
    const gate = ROUTE.slice(ROUTE.indexOf('// Audit gate:'), ROUTE.indexOf('// Side-effect transitions'))
    // The gate now also requires the audited total weight before Payment.
    expect(gate).toContain('checkAuditComplete(id, { requireWeight: true })')
    expect(gate).not.toContain('payment')
  })

  it('the audit gate counts inspected garments, never money', () => {
    const AUDIT_LIB = read('src/lib/laundry-audit.ts')
    expect(AUDIT_LIB).toContain('i.inspectedAt != null')
    expect(AUDIT_LIB).not.toContain('balanceDue')
    expect(AUDIT_LIB).not.toContain('paymentStatus')
  })
})

// ── CASE B · duplicate approval ────────────────────────────────────────────
describe('CASE B · a duplicate approval does not strand the order', () => {
  it('the same target status returns success, not 409', () => {
    expect(ROUTE).toContain('if (fromStatus === toStatus) {')
    expect(ROUTE).toContain('alreadyInStatus: true')
    const branch = ROUTE.slice(ROUTE.indexOf('if (fromStatus === toStatus) {'), ROUTE.indexOf('const transition = getTransition'))
    expect(branch).toContain('success: true')
    expect(branch).not.toContain('409')
  })

  it('it is a no-op — nothing is written on the second call', () => {
    const branch = ROUTE.slice(ROUTE.indexOf('if (fromStatus === toStatus) {'), ROUTE.indexOf('const transition = getTransition'))
    for (const w of ['update', 'create', 'delete']) expect(branch, w).not.toContain(w)
  })

  it('the idempotent branch runs AFTER the permission guard', () => {
    expect(ROUTE.indexOf('requireLaundryPermission')).toBeLessThan(ROUTE.indexOf('if (fromStatus === toStatus) {'))
  })

  it('the button is disabled while a request is in flight', () => {
    expect(AUDIT).toContain('disabled={acting || needsWeight}')
    expect(AUDIT).toContain('setActing(true)')
  })
})

// ── CASE C · existing rules unchanged ──────────────────────────────────────
describe('CASE C · the audit gate is intact', () => {
  it('approval is still refused while a garment is un-inspected', () => {
    expect(ROUTE).toContain("transition.action === \"APPROVE_AUDIT\" || transition.action === \"COMPLETE_AUDIT\"")
    expect(ROUTE).toContain('if (!audit.ok)')
    expect(ROUTE).toContain('{ status: 409 }')
  })

  it('the refusal now carries a readable reason on BOTH keys', () => {
    expect(ROUTE).toContain('error: audit.message, code: audit.code, message: audit.message')
    expect(ROUTE).toContain('expected: audit.expected, audited: audit.audited')
  })

  it('the screen shows that reason and the counts', () => {
    expect(AUDIT).toContain('json.error || json.message || "Transition failed"')
    expect(AUDIT).toContain('garments inspected)')
    expect(AUDIT).not.toContain('json.error || "Transition failed"') // the old swallow
  })

  it('a failed inspection save stops before the transition', () => {
    expect(AUDIT).toContain('const saved = await saveInspection()')
    expect(AUDIT).toContain('if (!saved) {')
    expect(AUDIT).toContain('the order was not approved')
    expect(AUDIT).not.toMatch(/await saveInspection\(\)\s*\n\s*const res = await fetch/)
  })

  it('the KG total-weight rule still runs first', () => {
    expect(AUDIT).toContain('if (toStatus === "PAYMENT_PENDING" && needsWeight)')
  })
})

// ── CASE D · invalid jumps still rejected ──────────────────────────────────
describe('CASE D · invalid workflow jumps are still refused', () => {
  it('Store Audit cannot jump to Delivered or Processing', () => {
    for (const to of ['DELIVERED', 'PROCESSING', 'PACKED', 'READY_FOR_DELIVERY'] as const) {
      expect(getTransition('PENDING_STORE_AUDIT', to), to).toBeUndefined()
    }
  })

  it('CANCELLED remains a deliberate edge, not something the fix opened up', () => {
    // It exists (Cancel is a real action) but is NOT the approval path, and it
    // carries its own permission.
    expect(getTransition('PENDING_STORE_AUDIT', 'CANCELLED')?.action).toBe('CANCEL')
    expect(ROUTE).toContain('toStatus === "CANCELLED" ? "laundry.orders.cancel" : "laundry.orders.edit"')
  })

  it('an unknown edge is still a 409 naming both stages', () => {
    // The refusal names where the order actually IS and where it cannot go —
    // a bare "Invalid transition" told the operator nothing when an order had
    // moved underneath the screen they were looking at.
    expect(ROUTE).toContain('This order is at ${statusLabel(fromStatus)} — it cannot move to ${statusLabel(toStatus)} from there.')
    expect(statusLabel('PENDING_STORE_AUDIT')).toBe('Pending Store Audit')
  })

  it('every 409 carries the order\'s real current stage', () => {
    // Three refusal shapes — unknown edge, audit gate, state invariants — and
    // all three report currentStatus so the screen can correct itself.
    expect(ROUTE.match(/currentStatus: fromStatus/g)?.length).toBe(3)
  })

  it('the state-invariant guard runs before the status is written', () => {
    expect(ROUTE.indexOf('guardStatusWrite')).toBeLessThan(ROUTE.indexOf('const updated = await prisma.laundryOrder.update'))
  })

  it('internal transitions still cannot be driven from this endpoint', () => {
    expect(ROUTE).toContain('if (transition.internal)')
    expect(TRANSITIONS.PAYMENT_PENDING.find((t) => t.action === 'COLLECT_PAYMENT')?.internal).toBe(true)
  })
})

// ── Invoice + transition ordering ──────────────────────────────────────────
describe('invoice and transition cannot end up half-done', () => {
  it('the invoice figures are written by the inspect save, which must succeed first', () => {
    const INSPECT = read('src/app/api/laundry/orders/[id]/inspect/route.ts')
    expect(INSPECT).toContain('billedAt: now')
    expect(INSPECT).toContain('inspectedAt: now')
    // The screen refuses to transition unless that save reported success.
    expect(AUDIT.indexOf('const saved = await saveInspection()')).toBeLessThan(AUDIT.indexOf('/transition`'))
  })

  it('re-running the approval is safe — both halves are idempotent', () => {
    // inspect re-stamps; transition answers alreadyInStatus.
    expect(ROUTE).toContain('alreadyInStatus: true')
    expect(AUDIT).toContain('const saved = await saveInspection()')
  })

  it('the queue and detail are reloaded after a successful approval', () => {
    expect(AUDIT).toContain('backToQueue(); loadQueue()')
  })
})
