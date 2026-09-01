import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  assertReconcilable, mayReconcile, reconciliationNote, reconciledStatusLabel,
  RECONCILIATION_TARGET, RECONCILIATION_EVENT, RECONCILIATION_LABEL, MIN_REASON_LENGTH,
} from '@/lib/laundry-reconciliation'
import { TRANSITIONS } from '@/lib/laundry-workflow'
import { buildReportRow, REPORT_COLUMNS } from '@/lib/laundry-order-report'

// ============================================================================
// ADMINISTRATIVE RECONCILIATION — an ATTESTATION, not a workflow shortcut.
//
// Orders whose physical work finished during the outage are stranded in stages
// whose only exits are custody edges. This records a named human saying what
// happened, marks it as weaker evidence forever, and leaves every existing
// guard exactly as it was.
// ============================================================================

const OWNER = { role: 'LAUNDRY_OWNER', isBusinessOwner: true, isSuperAdmin: false }
const SUPER = { role: 'QUANTIX_SUPER_ADMIN', isBusinessOwner: false, isSuperAdmin: true }
const STAFF = { role: 'STORE_MANAGER', isBusinessOwner: false, isSuperAdmin: false }
const AUDITOR = { role: 'READ_ONLY_AUDITOR', isBusinessOwner: false, isSuperAdmin: false }

const stranded = { status: 'READY_FOR_PROCESSING', administrativelyReconciled: false, reconciliationType: null }
const REASON = 'Order physically completed and delivered during the workflow outage.'

describe('only the Owner and Super Admin may attest', () => {
  it('owner may', () => expect(mayReconcile(OWNER)).toBe(true))
  it('super admin may', () => expect(mayReconcile(SUPER)).toBe(true))

  it('store staff may NOT', () => {
    expect(mayReconcile(STAFF)).toBe(false)
    const v = assertReconcilable(stranded, 'ADMIN_DELIVERED', REASON, STAFF)
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.code).toBe('FORBIDDEN')
  })

  it('a read-only platform role in support mode may NOT', () => {
    // resolved.isOwner is true for EVERY platform role in support mode, which
    // is why authority here is decided by role, not by that flag.
    expect(mayReconcile(AUDITOR)).toBe(false)
  })
})

describe('the reason is mandatory and must say something', () => {
  it('blank is refused', () => {
    for (const r of ['', '   ', null, undefined]) {
      const v = assertReconcilable(stranded, 'ADMIN_DELIVERED', r, OWNER)
      expect(v.ok).toBe(false)
      if (!v.ok) expect(v.code).toBe('REASON_REQUIRED')
    }
  })

  it('a keystroke to get past the field is refused', () => {
    const v = assertReconcilable(stranded, 'ADMIN_DELIVERED', 'ok', OWNER)
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.code).toBe('REASON_TOO_SHORT')
  })

  it('a real sentence is accepted', () => {
    expect(REASON.length).toBeGreaterThanOrEqual(MIN_REASON_LENGTH)
    expect(assertReconcilable(stranded, 'ADMIN_DELIVERED', REASON, OWNER).ok).toBe(true)
  })
})

describe('it works on exactly the orders that are stranded', () => {
  it('a late-stage order that normal cancel cannot reach is reconcilable', () => {
    // READY_FOR_PROCESSING has ONE edge (PACK_ORDER, custody) and no CANCEL.
    expect(TRANSITIONS.READY_FOR_PROCESSING.some((t) => t.to === 'CANCELLED')).toBe(false)
    expect(assertReconcilable(stranded, 'ADMIN_CANCEL', REASON, OWNER).ok).toBe(true)
    expect(assertReconcilable({ ...stranded, status: 'PROCESSING' }, 'ADMIN_DELIVERED', REASON, OWNER).ok).toBe(true)
  })

  it('an order the workflow already finished is NOT reconcilable', () => {
    for (const status of ['DELIVERED', 'CANCELLED']) {
      const v = assertReconcilable({ ...stranded, status }, 'ADMIN_DELIVERED', REASON, OWNER)
      expect(v.ok).toBe(false)
      if (!v.ok) expect(v.code).toBe('ALREADY_FINAL')
    }
  })

  it('cannot be done twice', () => {
    const done = { status: 'PROCESSING', administrativelyReconciled: true, reconciliationType: 'ADMIN_DELIVERED' }
    const v = assertReconcilable(done, 'ADMIN_CANCEL', REASON, OWNER)
    expect(v.ok).toBe(false)
    if (!v.ok) {
      expect(v.code).toBe('ALREADY_RECONCILED')
      expect(v.error).toContain('Administratively Delivered')
    }
  })

  it('an unknown attestation type is refused', () => {
    for (const t of ['', 'DELIVERED', 'ADMIN_WHATEVER', null]) {
      const v = assertReconcilable(stranded, t, REASON, OWNER)
      expect(v.ok).toBe(false)
      if (!v.ok) expect(v.code).toBe('INVALID_TYPE')
    }
  })

  it('lands only on DELIVERED or CANCELLED', () => {
    expect(RECONCILIATION_TARGET.ADMIN_DELIVERED).toBe('DELIVERED')
    expect(RECONCILIATION_TARGET.ADMIN_CANCEL).toBe('CANCELLED')
    expect(Object.values(RECONCILIATION_TARGET).sort()).toEqual(['CANCELLED', 'DELIVERED'])
  })
})

describe('a reconciled order is never mistaken for a normal one', () => {
  it('its own timeline action, distinct from every workflow action', () => {
    expect(RECONCILIATION_EVENT.ADMIN_DELIVERED).toBe('ADMIN_RECONCILE_DELIVERED')
    expect(RECONCILIATION_EVENT.ADMIN_CANCEL).toBe('ADMIN_RECONCILE_CANCELLED')
    const workflowActions = Object.values(TRANSITIONS).flat().map((t) => t.action)
    for (const a of Object.values(RECONCILIATION_EVENT)) expect(workflowActions).not.toContain(a)
  })

  it('the note carries the stage it was stranded in and the reason', () => {
    const note = reconciliationNote('ADMIN_DELIVERED', 'READY_FOR_PROCESSING', REASON)
    expect(note).toContain('Administratively Delivered')
    expect(note).toContain('Ready for Packing')
    expect(note).toContain(REASON)
  })

  it('the status reads as the attestation, not as Delivered', () => {
    expect(reconciledStatusLabel('DELIVERED', true, 'ADMIN_DELIVERED')).toBe('Administratively Delivered')
    expect(reconciledStatusLabel('CANCELLED', true, 'ADMIN_CANCEL')).toBe('Administratively Cancelled')
  })

  it('a normal order is labelled exactly as before', () => {
    expect(reconciledStatusLabel('DELIVERED', false, null)).toBe('Delivered')
    expect(RECONCILIATION_LABEL.ADMIN_DELIVERED).not.toBe('Delivered')
  })
})

describe('reporting can separate the two', () => {
  const base = {
    orderNumber: 'ORD-1', storeName: 'S', status: 'DELIVERED', orderType: 'WALK_IN',
    createdAt: null, pickupDate: null, pickupTimeSlot: null, deliveryDate: null, deliveryTimeSlot: null,
    customerName: null, customerPhone: null, customerEmail: null, customerCode: null, address: null,
    items: [], services: [], subtotal: 0, discount: 0, gstTotal: 0, grandTotal: 0,
    amountPaid: 0, balanceDue: 0, paymentStatus: 'PAID', paymentMethods: [], bagNumbers: [],
    auditedAt: null, deliveredAt: null,
  }
  const col = (name: string) => REPORT_COLUMNS.indexOf(name as never)

  it('the report carries a completion type column', () => {
    expect(col('Completion Type')).toBeGreaterThan(-1)
    expect(col('Reconciliation Reason')).toBeGreaterThan(-1)
    expect(col('Reconciled By')).toBeGreaterThan(-1)
  })

  it('a normally delivered order says so explicitly, never a blank', () => {
    const row = buildReportRow(base)
    expect(row[col('Completion Type')]).toBe('Normal Workflow')
  })

  it('a reconciled delivery is marked, with who and why', () => {
    const row = buildReportRow({
      ...base, administrativelyReconciled: true, reconciliationType: 'ADMIN_DELIVERED',
      reconciliationReason: REASON, reconciledBy: 'Quantix Super Admin',
    })
    expect(row[col('Completion Type')]).toBe('DELIVERED — ADMINISTRATIVE RECONCILIATION')
    expect(row[col('Reconciliation Reason')]).toBe(REASON)
    expect(row[col('Reconciled By')]).toBe('Quantix Super Admin')
  })

  it('a reconciled cancellation is marked differently again', () => {
    const row = buildReportRow({ ...base, status: 'CANCELLED', administrativelyReconciled: true, reconciliationType: 'ADMIN_CANCEL' })
    expect(row[col('Completion Type')]).toBe('CANCELLED — ADMINISTRATIVE RECONCILIATION')
  })

  it('every row still has one value per column', () => {
    expect(buildReportRow(base)).toHaveLength(REPORT_COLUMNS.length)
  })
})

// ── what was NOT touched ────────────────────────────────────────────────────
const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const ROUTE = read('src/app/api/laundry/orders/[id]/reconcile/route.ts')
/** The route's CODE, with the prose that explains it stripped — the guarantees
 *  below are about what it does, not about what its header says it avoids. */
const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const ROUTE_CODE = stripComments(ROUTE)
const LIB = read('src/lib/laundry-reconciliation.ts')
const STATE = read('src/lib/laundry-order-state.ts')
const DETAIL = read('src/components/laundry/views/laundry-order-detail.tsx')

describe('the custody guards are not weakened, relaxed or reachable from here', () => {
  it('the endpoint never grants allowInternal or custodyAction', () => {
    for (const w of ['allowInternal', 'custodyAction', 'deliveryCompletion', 'guardStatusWrite']) {
      expect(ROUTE_CODE, w).not.toContain(w)
    }
  })

  it('it never calls the workflow transition path', () => {
    expect(ROUTE_CODE).not.toContain('assertTransition')
    expect(ROUTE_CODE).not.toContain('/transition')
  })

  it('no reconciliation edge was added to the workflow', () => {
    const actions = Object.values(TRANSITIONS).flat().map((t) => t.action)
    expect(actions.filter((a) => a.startsWith('ADMIN_'))).toEqual([])
    // READY_FOR_DELIVERY → DELIVERED is still internal AND custody.
    const del = TRANSITIONS.READY_FOR_DELIVERY.find((t) => t.to === 'DELIVERED')
    expect(del?.internal).toBe(true)
    expect(del?.custody).toBe(true)
  })

  it('the state-integrity module is unchanged by this work', () => {
    // Still the sole authority for workflow writes, with its rules intact.
    expect(STATE).toContain('if (edge.custody && !opts.custodyAction)')
    expect(STATE).toContain('status === "DELIVERED" && !opts.deliveryCompletion && !deliveryCompleted(ev)')
    // Its own pre-existing reconcileStatus (which walks a corrupted row BACK to
    // the stage its evidence supports) is untouched and unrelated. What must not
    // exist is an ADMIN attestation backdoor inside the guard itself.
    expect(STATE).toContain('export function reconcileStatus')
    expect(STATE).not.toContain('ADMIN_DELIVERED')
    expect(STATE).not.toContain('administrativelyReconciled')
  })

  it('deliveredAt is never written, so a reconciled order fails deliveryCompleted()', () => {
    expect(ROUTE_CODE).not.toContain('deliveredAt:')
    expect(ROUTE_CODE).not.toContain('deliveryCompletedAt:')
  })
})

describe('history is preserved, never rewritten', () => {
  it('the endpoint only creates timeline rows', () => {
    expect(ROUTE).toContain('laundryOrderEvent.create')
    for (const w of ['laundryOrderEvent.delete', 'laundryOrderEvent.update', 'deleteMany', 'updateMany']) {
      expect(ROUTE_CODE, w).not.toContain(w)
    }
  })

  it('the whole attestation is one transaction', () => {
    expect(ROUTE).toContain('prisma.$transaction')
  })

  it('actor, reason, previous status and timestamp are all recorded', () => {
    for (const f of ['reconciliationType', 'reconciledFromStatus', 'reconciledAt', 'reconciledBy', 'reconciledByUserId', 'reconciliationReason', 'administrativelyReconciled', 'actualCompletionAt']) {
      expect(ROUTE, f).toContain(f)
    }
  })
})

describe('the screen enforces the same rules before asking the server', () => {
  it('the control is Owner / Super Admin only', () => {
    expect(DETAIL).toContain('const mayReconcileOrder = isSuperAdmin || isBusinessOwner')
    expect(DETAIL).toContain('mayReconcileOrder && !order.administrativelyReconciled')
  })

  it('it is not offered on an order the workflow already finished', () => {
    expect(DETAIL).toContain('order.status !== "DELIVERED" && order.status !== "CANCELLED"')
  })

  it('a blank reason cannot be submitted', () => {
    expect(DETAIL).toContain('const reasonOk = recReason.trim().length >= MIN_REASON_LENGTH')
    expect(DETAIL).toContain('disabled={!recType || !reasonOk}')
  })

  it('there is a confirmation step showing the previous status and the action', () => {
    expect(DETAIL).toContain('Confirm this reconciliation')
    expect(DETAIL).toContain('Previous status:')
    expect(DETAIL).toContain('recStep === "choose"')
  })

  it('the reconciliation is stated on the order, not hidden in a tooltip', () => {
    expect(DETAIL).toContain('This was NOT recorded by the delivery workflow')
  })
})

describe('the orders list shows the difference too', () => {
  const LIST = readFileSync(join(process.cwd(), 'src/components/laundry/views/laundry-orders-view.tsx'), 'utf8')

  it('a reconciled order is badged in the queue, not just on the detail page', () => {
    expect(LIST).toContain('o.administrativelyReconciled &&')
    expect(LIST).toContain('RECONCILIATION_LABEL[o.reconciliationType as ReconciliationType]')
  })

  it('the row still shows its real status alongside', () => {
    // The badge now leads with the OPERATIONAL queue and keeps the workflow
    // status as a secondary line beneath it — still shown, no longer the thing
    // the operator has to decode.
    expect(LIST).toContain('{o.operationalStage || statusLabel(o.status)}')
    expect(LIST).toContain('<p className="mt-0.5 text-[10px] text-slate-400">{statusLabel(o.status)}</p>')
  })
})

describe('the rule module decides nothing operational', () => {
  it('is pure — no fetch, no database, no status writes', () => {
    const code = LIB.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    for (const w of ['fetch(', 'prisma', 'NextResponse', 'await ']) {
      expect(code, w).not.toContain(w)
    }
  })
})
