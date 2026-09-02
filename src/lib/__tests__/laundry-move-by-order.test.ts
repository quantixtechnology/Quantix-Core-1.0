import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  MOVE_BY_ORDER_STAGES,
  MOVE_BY_ORDER_PROMPT,
  moveByOrderConfig,
  supportsMoveByOrder,
  ordersInQueue,
  findOrderInQueue,
  planOrderMove,
  moveByOrderNote,
  isMovable,
  moveProgressLabel,
  moveOutcome,
  MOVE_WAIT_NOTICE,
  orderNumberPrefix,
  prefixOfOrderNumber,
  displayOrderPrefix,
  composeOrderNumber,
  ORDER_SUFFIX_PLACEHOLDER,
  type QueueGarment,
} from '@/lib/laundry-move-by-order'
import { sortingOrderSummary } from '@/lib/laundry-order-display'

// ============================================================================
// Move by Order is an ADDITIONAL way through Washing / Dry Cleaning, never a
// replacement for scanning. These pin the three things that make it safe:
//
//   • it can only reach an order that is in THIS stage's queue right now;
//   • nothing mutates until the operator answers the confirmation;
//   • the move runs through the SAME canonical endpoint a scan drives, so the
//     server — not this client's copy of the queue — decides eligibility.
//
// `processingStage` lives only on LaundryOrderItem, so moving an order IS
// moving its garments. That is the domain model, not a shortcut around it.
// ============================================================================

const g = (over: Partial<QueueGarment> & { id: string }): QueueGarment => ({
  orderId: 'o1', orderNumber: 'ORD-STR-BUS-202608-0008-002-000070',
  customer: 'Pravin', serviceName: 'Wash & Fold', processingStatus: 'WAITING',
  orderTotalWeightKg: 6, ...over,
})

const queue18 = Array.from({ length: 18 }, (_, i) => g({ id: `i${i}` }))

describe('stage scoping', () => {
  it('offers the fast track at Washing and Dry Cleaning only', () => {
    expect([...MOVE_BY_ORDER_STAGES]).toEqual(['WASH', 'DRYCLEAN'])
    expect(supportsMoveByOrder('WASH')).toBe(true)
    expect(supportsMoveByOrder('DRYCLEAN')).toBe(true)
    for (const s of ['QC', 'SORTING', 'IRON', 'FOLD', 'PACKED', 'DISPATCHED', '']) {
      expect(supportsMoveByOrder(s), s).toBe(false)
      expect(moveByOrderConfig(s)).toBeNull()
    }
  })

  it('each stage names its own destination and its own not-found message', () => {
    expect(moveByOrderConfig('WASH')).toMatchObject({
      pushLabel: 'Push Order to Wash',
      modalTitle: 'Push Order to Washing?',
      prompt: 'Do you want to move this order to the Wash process?',
      notFound: 'Order not found in the Washing queue.',
    })
    expect(moveByOrderConfig('DRYCLEAN')).toMatchObject({
      pushLabel: 'Push Order to Dry Clean',
      modalTitle: 'Push Order to Dry Cleaning?',
      prompt: 'Do you want to move this order to the Dry Clean process?',
      notFound: 'Order not found in the Dry Cleaning queue.',
    })
  })
})

describe('lookup against the CURRENT queue', () => {
  it('1 · a blank field asks for a number and selects nothing', () => {
    for (const q of ['', '   ']) {
      const r = findOrderInQueue(queue18, q, 'WASH')
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error).toBe('Enter a Store / Order number.')
    }
  })

  it('2 · a valid eligible order resolves, with all its garments', () => {
    const r = findOrderInQueue(queue18, 'ORD-STR-BUS-202608-0008-002-000070', 'WASH')
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.order.orderId).toBe('o1')
      expect(r.order.garments).toHaveLength(18)
      expect(r.order.customer).toBe('Pravin')
      expect(r.order.totalWeightKg).toBe(6)
    }
  })

  it('2b · matching tolerates case, spacing and a unique suffix', () => {
    for (const q of ['  ord-str-bus-202608-0008-002-000070  ', '000070', '002-000070']) {
      expect(findOrderInQueue(queue18, q, 'WASH').ok, q).toBe(true)
    }
  })

  it('2c · an ambiguous fragment is refused rather than guessed', () => {
    const two = [...queue18, g({ id: 'x', orderId: 'o2', orderNumber: 'ORD-STR-BUS-202608-0008-002-000071' })]
    const r = findOrderInQueue(two, 'ORD-STR-BUS', 'WASH')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/2 orders in this queue match/)
  })

  it('3 · an invalid order number is refused with this queue’s own message', () => {
    const r = findOrderInQueue(queue18, 'NOT-A-REAL-ORDER', 'WASH')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('Order not found in the Washing queue.')
  })

  it('4 · an order absent from this queue is refused', () => {
    const r = findOrderInQueue([], 'ORD-STR-BUS-202608-0008-002-000070', 'DRYCLEAN')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('Order not found in the Dry Cleaning queue.')
  })

  it('5+17+18 · a Washing queue cannot reach a Dry Cleaning order, or vice versa', () => {
    // The queue is fetched as processingStage = <this stage>, so a garment at
    // the other stage is simply not in the list the lookup can see. The server
    // repeats the check via expectedStage.
    const washQueue = [g({ id: 'w1', orderId: 'oW', orderNumber: 'ORD-WASH-1', serviceName: 'Wash & Fold' })]
    const dcQueue = [g({ id: 'd1', orderId: 'oD', orderNumber: 'ORD-DC-1', serviceName: 'Dry Clean' })]
    expect(findOrderInQueue(washQueue, 'ORD-DC-1', 'WASH').ok).toBe(false)
    expect(findOrderInQueue(dcQueue, 'ORD-WASH-1', 'DRYCLEAN').ok).toBe(false)
    // …and each finds its own.
    expect(findOrderInQueue(washQueue, 'ORD-WASH-1', 'WASH').ok).toBe(true)
    expect(findOrderInQueue(dcQueue, 'ORD-DC-1', 'DRYCLEAN').ok).toBe(true)
  })

  it('6 · finished garments are neither counted nor movable', () => {
    expect(isMovable({ processingStatus: 'WAITING' })).toBe(true)
    expect(isMovable({ processingStatus: 'IN_PROGRESS' })).toBe(true)
    expect(isMovable({ processingStatus: 'PAUSED' })).toBe(true)
    expect(isMovable({ processingStatus: 'DONE' })).toBe(false)
    expect(isMovable({ processingStatus: 'REJECTED' })).toBe(false)
    const mixed = [g({ id: 'a' }), g({ id: 'b', processingStatus: 'DONE' }), g({ id: 'c', processingStatus: 'REJECTED' })]
    const r = findOrderInQueue(mixed, 'ORD-STR-BUS-202608-0008-002-000070', 'WASH')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.order.garments.map((x) => x.id)).toEqual(['a'])
  })

  it('an order whose garments are ALL finished is not in the queue at all', () => {
    const done = [g({ id: 'a', processingStatus: 'DONE' })]
    expect(ordersInQueue(done)).toHaveLength(0)
    expect(findOrderInQueue(done, 'ORD-STR-BUS-202608-0008-002-000070', 'WASH').ok).toBe(false)
  })
})

describe('7 · the selected order identifies itself', () => {
  it('shows order, customer, service, count and weight', () => {
    const r = findOrderInQueue(queue18, '000070', 'WASH')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const o = r.order
    expect(o.orderNumber).toBe('ORD-STR-BUS-202608-0008-002-000070')
    expect(o.customer).toBe('Pravin')
    expect(sortingOrderSummary({ garments: o.garments, garmentCount: o.garments.length, totalWeightKg: o.totalWeightKg }))
      .toBe('Wash & Fold · 18 garments · 6 kg')
  })

  it('19 · missing weight shows an em dash, not 0 kg', () => {
    const noWeight = queue18.map((x) => ({ ...x, orderTotalWeightKg: 0 }))
    const r = findOrderInQueue(noWeight, '000070', 'WASH')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(sortingOrderSummary({ garments: r.order.garments, garmentCount: r.order.garments.length, totalWeightKg: r.order.totalWeightKg }))
      .toBe('Wash & Fold · 18 garments · —')
  })

  it('20 · the count is independent of the weight in both directions', () => {
    const noWeight = queue18.map((x) => ({ ...x, orderTotalWeightKg: null }))
    const r = findOrderInQueue(noWeight, '000070', 'WASH')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.order.garments).toHaveLength(18)   // count survives a missing weight
    expect(r.order.totalWeightKg).toBeNull()
  })
})

describe('the planned move uses the canonical transition', () => {
  it('starts a waiting garment before completing it — the endpoint requires it', () => {
    const r = findOrderInQueue([g({ id: 'a', processingStatus: 'WAITING' })], '000070', 'WASH')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(planOrderMove(r.order)).toEqual([{ itemId: 'a', actions: ['START', 'COMPLETE'] }])
  })

  it('completes an already in-progress garment without restarting it', () => {
    const r = findOrderInQueue([g({ id: 'a', processingStatus: 'IN_PROGRESS' })], '000070', 'WASH')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(planOrderMove(r.order)).toEqual([{ itemId: 'a', actions: ['COMPLETE'] }])
  })

  it('resumes a paused garment rather than starting it', () => {
    const r = findOrderInQueue([g({ id: 'a', processingStatus: 'PAUSED' })], '000070', 'WASH')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(planOrderMove(r.order)).toEqual([{ itemId: 'a', actions: ['RESUME', 'COMPLETE'] }])
  })

  it('plans one entry per movable garment and none for finished ones', () => {
    const mixed = [g({ id: 'a' }), g({ id: 'b', processingStatus: 'DONE' }), g({ id: 'c', processingStatus: 'IN_PROGRESS' })]
    const r = findOrderInQueue(mixed, '000070', 'WASH')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(planOrderMove(r.order).map((p) => p.itemId)).toEqual(['a', 'c'])
  })

  it('15 · the actions are real transitions — never a fabricated SCAN', () => {
    const r = findOrderInQueue(queue18, '000070', 'WASH')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const actions = new Set(planOrderMove(r.order).flatMap((p) => p.actions))
    expect(actions.has('SCAN' as never)).toBe(false)
    for (const a of actions) expect(['START', 'RESUME', 'COMPLETE']).toContain(a)
  })

  it('the audit note says what happened, not that a barcode was read', () => {
    const note = moveByOrderNote('ORD-1', 'Asha')
    expect(note).toBe('Moved by order ORD-1 — operator confirmed all garments present (Asha)')
    expect(note).not.toMatch(/scan/i)
    expect(moveByOrderNote('ORD-1', null)).toBe('Moved by order ORD-1 — operator confirmed all garments present')
  })
})

// ── The workstation wiring, and the untouched scanning workflow ─────────────
const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const WS = read('src/components/laundry/views/laundry-workstation.tsx')
const PROCESS_API = read('src/app/api/laundry/items/[id]/process/route.ts')

describe('8-12 · nothing moves before the operator confirms', () => {
  it('8 · the push button only opens the dialog', () => {
    expect(WS).toContain('onClick={() => setMoveConfirm(true)}')
    expect(WS).toContain('{moveCfg.pushLabel}')
  })

  it('9 · Cancel closes the dialog and mutates nothing', () => {
    expect(WS).toContain('onClick={() => setMoveConfirm(false)}')
  })

  it('10+11 · only "Yes, Move Order" runs the mutation', () => {
    expect(WS).toContain('onClick={runMoveByOrder}')
    expect(WS).toContain('"Yes, Move Order"')
    // The fetch loop lives in runMoveByOrder and nowhere else.
    expect((WS.match(/const runMoveByOrder = async/g) || []).length).toBe(1)
    const finder = WS.slice(WS.indexOf('const findMoveOrder'), WS.indexOf('const clearMove'))
    expect(finder).not.toContain('fetch(')
  })

  it('12 · both dialog buttons are disabled while the move is in flight', () => {
    const dlg = WS.slice(WS.indexOf('MOVE_BY_ORDER_PROMPT'))
    expect(dlg).toContain('disabled={moving}')
    expect(WS).toContain('if (!movePicked || moving) return')
  })

  it('the prompt is the exact question the operator must answer', () => {
    expect(MOVE_BY_ORDER_PROMPT).toBe('Are you sure you have all the garments and want to push this order?')
    expect(WS).toContain('{MOVE_BY_ORDER_PROMPT}')
  })
})

describe('16 · the server stays authoritative', () => {
  it('every call carries expectedStage, which the endpoint enforces', () => {
    const run = WS.slice(WS.indexOf('const runMoveByOrder'), WS.indexOf('const bulkAdvance'))
    expect(run).toContain('expectedStage: stage')
    expect(PROCESS_API).toContain('if (expectedStage && item.processingStage !== expectedStage)')
  })

  it('the endpoint keeps its optimistic lock, so a raced garment 409s', () => {
    expect(PROCESS_API).toContain('where: { id, processingStatus: curStatus }')
    expect(PROCESS_API).toContain('Conflict — garment was already moved by another operator')
  })

  it('a failed garment is counted, never retried or forced', () => {
    const run = WS.slice(WS.indexOf('const runMoveByOrder'), WS.indexOf('const bulkAdvance'))
    expect(run).toContain('advanced = false')
    expect(run).not.toMatch(/force|override|skipGuard/i)
  })

  it('the queue is reloaded from the server after the move', () => {
    const run = WS.slice(WS.indexOf('const runMoveByOrder'), WS.indexOf('const bulkAdvance'))
    expect(run).toContain('load(true)')
  })
})

describe('13-14 · the existing garment scanning workflow is untouched', () => {
  it('the barcode scanner is still mounted and prominent', () => {
    expect(WS).toContain('<LaundryBarcodeScanner onDetect={handleBarcode}')
  })

  it('per-garment scan, start/complete and bulk advance all survive', () => {
    expect(WS).toContain('const handleBarcode')
    expect(WS).toContain('const act = useCallback')
    expect(WS).toContain('const bulkAdvance = async')
    expect(WS).toContain('/api/laundry/scan?barcode=')
  })

  it('scan progress and the queue columns are unchanged', () => {
    expect(WS).toContain('const waiting = items.filter((i) => i.processingStatus === "WAITING")')
    expect(WS).toContain('const inProgress = active.filter((i) => i.processingStatus === "IN_PROGRESS")')
  })

  it('Move by Order reuses the canonical endpoint — no parallel state machine', () => {
    const run = WS.slice(WS.indexOf('const runMoveByOrder'), WS.indexOf('const bulkAdvance'))
    expect(run).toContain('/api/laundry/items/${step.itemId}/process')
    // No direct status writes from the UI.
    expect(run).not.toMatch(/processingStage\s*:/)
    expect(run).not.toMatch(/prisma|laundryOrderItem\.update/)
  })

  it('the panel is gated to the two stages that offer it', () => {
    expect(WS).toContain('const moveCfg = moveByOrderConfig(stage)')
    expect(WS).toContain('{moveCfg && canProcess && (')
  })
})


// ── Progress, and what "complete" is allowed to mean ────────────────────────
describe('1-3 · order size is not capped', () => {
  const order = (n: number) => {
    const gs = Array.from({ length: n }, (_, i) => g({ id: `i${i}` }))
    const r = findOrderInQueue(gs, '000070', 'WASH')
    if (!r.ok) throw new Error('lookup failed')
    return r.order
  }

  it('1 · a single-garment order plans one move', () => {
    expect(planOrderMove(order(1))).toHaveLength(1)
  })

  it('2 · a 50-garment order plans fifty — no cap, no truncation', () => {
    expect(planOrderMove(order(50))).toHaveLength(50)
  })

  it('3 · a 120-garment order plans all one hundred and twenty', () => {
    const plan = planOrderMove(order(120))
    expect(plan).toHaveLength(120)
    expect(new Set(plan.map((p) => p.itemId)).size).toBe(120)
  })
})

describe('4-5 · the operator is told to wait, with real numbers', () => {
  it('4 · progress counts attempted items against the total', () => {
    expect(moveProgressLabel({ done: 0, failed: 0, total: 50 })).toBe('Moving 0 of 50 items')
    expect(moveProgressLabel({ done: 27, failed: 0, total: 50 })).toBe('Moving 27 of 50 items')
    expect(moveProgressLabel({ done: 25, failed: 2, total: 50 })).toBe('Moving 27 of 50 items')
    expect(moveProgressLabel({ done: 50, failed: 0, total: 50 })).toBe('Moving 50 of 50 items')
    expect(moveProgressLabel({ done: 1, failed: 0, total: 1 })).toBe('Moving 1 of 1 item')
  })

  it('5 · the wait notice is exact and is rendered during the run', () => {
    expect(MOVE_WAIT_NOTICE).toBe('Please wait until all items are moved.')
    expect(WS).toContain('{MOVE_WAIT_NOTICE}')
    expect(WS).toContain('Moving Order')
    expect(WS).toContain('{moveProgressLabel(moveProgress)}')
  })

  it('the progress panel replaces the question — never a bare spinner', () => {
    expect(WS).toContain('moving && moveProgress ?')
  })
})

describe('6-7 · success is all-or-it-is-not-success', () => {
  it('6 · every eligible garment moved is the ONLY success', () => {
    const o = moveOutcome({ done: 50, failed: 0, total: 50 })
    expect(o.complete).toBe(true)
    expect(o.title).toContain('all 50 items')
  })

  it('7 · 27 of 50 is reported as a partial move, never as success', () => {
    const o = moveOutcome({ done: 27, failed: 23, total: 50 })
    expect(o.complete).toBe(false)
    expect(o.title).toContain('NOT fully moved')
    expect(o.title).toContain('27 of 50')
    expect(o.title).not.toMatch(/successfully/i)
    expect(o.description).toMatch(/23 items could not be moved/)
    expect(o.description).toMatch(/queue has been reloaded/)
  })

  it('a single failure is still not success', () => {
    expect(moveOutcome({ done: 49, failed: 1, total: 50 }).complete).toBe(false)
  })

  it('an empty run reports nothing to move, not success', () => {
    const o = moveOutcome({ done: 0, failed: 0, total: 0 })
    expect(o.complete).toBe(false)
    expect(o.title).toBe('Nothing to move')
  })

  it('the UI takes its verdict from moveOutcome, not from a raw count', () => {
    const run = WS.slice(WS.indexOf('const runMoveByOrder'), WS.indexOf('const bulkAdvance'))
    expect(run).toContain('const outcome = moveOutcome(')
    expect(run).toContain('variant: outcome.complete ? undefined : "destructive"')
    // The success chime only sounds on a complete move.
    expect(run).toContain('if (outcome.complete) playScanOk(soundEnabled)')
  })
})

describe('8-10 · conflicts, duplicates and the queue', () => {
  it('8 · a conflicted garment counts as failed, so the run cannot report success', () => {
    const run = WS.slice(WS.indexOf('const runMoveByOrder'), WS.indexOf('const bulkAdvance'))
    expect(run).toContain('if (!res.ok || !j.success) { advanced = false; break }')
    expect(run).toContain('if (advanced) ok++; else fail++')
  })

  it('9 · a second run for the same order cannot start while one is in flight', () => {
    expect(WS).toContain('if (!movePicked || moving) return')
    const dlg = WS.slice(WS.indexOf('MOVE_BY_ORDER_PROMPT'))
    expect(dlg).toContain('disabled={moving}')
    // The dialog itself cannot be dismissed mid-run.
    expect(WS).toContain('onOpenChange={(o) => { if (!moving) setMoveConfirm(o) }}')
  })

  it('10 · the queue is reloaded from the server whatever the outcome', () => {
    const run = WS.slice(WS.indexOf('const runMoveByOrder'), WS.indexOf('const bulkAdvance'))
    expect(run).toContain('load(true)')
    // Reload is after the verdict, not inside a success branch.
    expect(run.indexOf('const outcome = moveOutcome(')).toBeLessThan(run.indexOf('load(true)'))
  })

  it('no cancel is offered mid-run — the backend cannot undo a committed move', () => {
    const dlg = WS.slice(WS.indexOf('MOVE_BY_ORDER_PROMPT'))
    expect(dlg).toContain('<Button variant="outline" onClick={() => setMoveConfirm(false)} disabled={moving}>No, Cancel</Button>')
  })
})


// ── The order-number prefix the operator never retypes ──────────────────────
describe('1-4 · the business prefix is derived, never typed and never hardcoded', () => {
  it('1 · the prefix is built from the canonical business code', () => {
    // Mirrors generateOrderNumber: ORD-{storeCode}-{seq}, storeCode = STR-{businessCode}-{seq}
    expect(orderNumberPrefix('BUS-202608-0008')).toBe('ORD-STR-BUS-202608-0008-')
    expect(orderNumberPrefix('BUS-202512-0001')).toBe('ORD-STR-BUS-202512-0001-')
  })

  it('1b · no month, business or store value is baked into the source', () => {
    const SRC = read('src/lib/laundry-move-by-order.ts')
    const code = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(code).not.toMatch(/202[0-9]{3}/)      // no YYYYMM
    expect(code).not.toContain('BUS-')            // no business code
    expect(code).not.toMatch(/'0008'|"0008"/)     // no store/business sequence
  })

  it('1c · an unknown business code yields no prefix, not a wrong one', () => {
    for (const v of [null, undefined, '', '   ']) expect(orderNumberPrefix(v)).toBe('')
  })

  it('2 · the workstation renders the prefix as a non-editable adornment', () => {
    expect(WS).toContain('{movePrefix}')
    // Derived from the queue's own order numbers, with the canonical business
    // code as the fallback — see the REGRESSION suite below.
    expect(WS).toContain('const movePrefix = displayOrderPrefix(items, businessCode)')
    // Derived from the server response, never a literal.
    expect(WS).toContain('setBusinessCode(j.businessCode ?? null)')
    // It is a span, not an input — it cannot be typed over.
    expect(WS).toMatch(/<span[^>]*aria-hidden="true"[\s\S]{0,400}\{movePrefix\}/)
  })

  it('3 · the operator types only store number + order digits', () => {
    expect(ORDER_SUFFIX_PLACEHOLDER).toBe('002-000005')
    expect(WS).toContain('placeholder={movePrefix ? ORDER_SUFFIX_PLACEHOLDER : "Full order number"}')
  })

  it('4 · "002-000005" composes to the full business order number', () => {
    const prefix = orderNumberPrefix('BUS-202608-0008')
    expect(composeOrderNumber(prefix, '002-000005')).toBe('ORD-STR-BUS-202608-0008-002-000005')
    // and the lookup receives the composed value
    expect(WS).toContain('findOrderInQueue(items, composeOrderNumber(movePrefix, moveQuery), stage)')
  })

  it('4b · composition tolerates case, spaces and a pasted full number', () => {
    const prefix = orderNumberPrefix('BUS-202608-0008')
    expect(composeOrderNumber(prefix, ' 002-000005 ')).toBe('ORD-STR-BUS-202608-0008-002-000005')
    expect(composeOrderNumber(prefix, '002-000005'.toLowerCase())).toBe('ORD-STR-BUS-202608-0008-002-000005')
    // A pasted full number is used as-is, never concatenated twice.
    const full = 'ORD-STR-BUS-202608-0008-002-000005'
    expect(composeOrderNumber(prefix, full)).toBe(full)
    expect(composeOrderNumber(prefix, full.toLowerCase())).toBe(full)
    // Even one from another month/business.
    expect(composeOrderNumber(prefix, 'ORD-STR-BUS-202501-0002-001-000009')).toBe('ORD-STR-BUS-202501-0002-001-000009')
  })

  it('4c · a stray leading dash does not double up', () => {
    expect(composeOrderNumber('ORD-STR-BUS-202608-0008-', '-002-000005')).toBe('ORD-STR-BUS-202608-0008-002-000005')
  })

  it('5 · an empty entry composes to nothing and the lookup asks for a number', () => {
    expect(composeOrderNumber('ORD-STR-BUS-202608-0008-', '')).toBe('')
    const r = findOrderInQueue(queue18, '', 'WASH')
    expect(r.ok).toBe(false)
  })

  it('with no prefix known, a full number still works', () => {
    expect(composeOrderNumber('', 'ORD-STR-BUS-202608-0008-002-000005')).toBe('ORD-STR-BUS-202608-0008-002-000005')
  })
})

describe('11 · the stage-specific confirmation', () => {
  it('asks the Wash / Dry Clean question, per stage', () => {
    expect(moveByOrderConfig('WASH')!.prompt).toBe('Do you want to move this order to the Wash process?')
    expect(moveByOrderConfig('DRYCLEAN')!.prompt).toBe('Do you want to move this order to the Dry Clean process?')
    expect(WS).toContain('{moveCfg?.prompt}')
  })

  it('keeps the all-garments assertion beneath it', () => {
    expect(WS).toContain('{MOVE_BY_ORDER_PROMPT}')
  })

  it('uses the requested button labels', () => {
    expect(WS).toContain('>No, Cancel</Button>')
    expect(WS).toContain('"Yes, Move Order"')
  })

  it('the push button names the destination and only one stage shows it', () => {
    expect(moveByOrderConfig('WASH')!.pushLabel).toBe('Push Order to Wash')
    expect(moveByOrderConfig('DRYCLEAN')!.pushLabel).toBe('Push Order to Dry Clean')
    expect(WS).toContain('{moveCfg.pushLabel}')
    expect(WS).toContain('{moveCfg && canProcess && (')
  })
})


// ── REGRESSION: the displayed prefix must match the queue's real orders ─────
//
// Shipped bug: the prefix was built from LaundryBusiness.businessCode, which
// carries the workspace's RETIRED product code (LND-202608-0002), while order
// numbers embed the CANONICAL platform Business Code (BUS-202608-0008). The UI
// showed ORD-STR-LND-202608-0002- and every lookup missed.
//
// The guarantee these pin: whatever the business code says, the prefix on
// screen is the prefix of the orders actually in this queue.
describe('REGRESSION · displayed prefix matches the queue’s order numbers', () => {
  const REAL = 'ORD-STR-BUS-202608-0008-002-000005'
  const LEGACY_CODE = 'LND-202608-0002'          // what LaundryBusiness carries
  const CANONICAL_CODE = 'BUS-202608-0008'       // what order numbers embed

  it('splits a real order number into its fixed prefix', () => {
    expect(prefixOfOrderNumber(REAL)).toBe('ORD-STR-BUS-202608-0008-')
    expect(prefixOfOrderNumber('ord-str-bus-202608-0008-002-000005')).toBe('ORD-STR-BUS-202608-0008-')
  })

  it('THE BUG: a legacy LND business code can no longer drive the display', () => {
    const queue = [g({ id: 'a', orderNumber: REAL })]
    // Even handed the WRONG (legacy) code, the queue's own orders win.
    expect(displayOrderPrefix(queue, LEGACY_CODE)).toBe('ORD-STR-BUS-202608-0008-')
    expect(displayOrderPrefix(queue, LEGACY_CODE)).not.toContain('LND')
  })

  it('the displayed prefix + "002-000005" reconstructs the queue’s own order', () => {
    const queue = [g({ id: 'a', orderNumber: REAL })]
    const prefix = displayOrderPrefix(queue, LEGACY_CODE)
    expect(composeOrderNumber(prefix, '002-000005')).toBe(REAL)
    // …and that composed value resolves against the queue.
    const r = findOrderInQueue(queue, composeOrderNumber(prefix, '002-000005'), 'WASH')
    expect(r.ok).toBe(true)
  })

  it('every order in the queue is reachable by typing only its last two parts', () => {
    const queue = [
      g({ id: 'a', orderId: 'o1', orderNumber: 'ORD-STR-BUS-202608-0008-002-000005' }),
      g({ id: 'b', orderId: 'o2', orderNumber: 'ORD-STR-BUS-202608-0008-002-000006' }),
      g({ id: 'c', orderId: 'o3', orderNumber: 'ORD-STR-BUS-202608-0008-003-000001' }),
    ]
    const prefix = displayOrderPrefix(queue, LEGACY_CODE)
    for (const [typed, expected] of [
      ['002-000005', 'ORD-STR-BUS-202608-0008-002-000005'],
      ['002-000006', 'ORD-STR-BUS-202608-0008-002-000006'],
      ['003-000001', 'ORD-STR-BUS-202608-0008-003-000001'],
    ] as const) {
      expect(composeOrderNumber(prefix, typed)).toBe(expected)
      const r = findOrderInQueue(queue, composeOrderNumber(prefix, typed), 'WASH')
      expect(r.ok, typed).toBe(true)
      if (r.ok) expect(r.order.orderNumber).toBe(expected)
    }
  })

  it('the canonical code is used when the queue is empty', () => {
    expect(displayOrderPrefix([], CANONICAL_CODE)).toBe('ORD-STR-BUS-202608-0008-')
    expect(displayOrderPrefix(null, CANONICAL_CODE)).toBe('ORD-STR-BUS-202608-0008-')
  })

  it('a queue spanning two different prefixes shows none rather than a wrong one', () => {
    const mixed = [
      g({ id: 'a', orderId: 'o1', orderNumber: 'ORD-STR-BUS-202608-0008-002-000005' }),
      g({ id: 'b', orderId: 'o2', orderNumber: 'ORD-STR-BUS-202501-0002-001-000009' }),
    ]
    // No single answer → falls back to the canonical code.
    expect(displayOrderPrefix(mixed, CANONICAL_CODE)).toBe('ORD-STR-BUS-202608-0008-')
    // …and with no canonical code either, no prefix at all.
    expect(displayOrderPrefix(mixed, null)).toBe('')
  })

  it('malformed order numbers never produce a prefix', () => {
    for (const v of [null, undefined, '', 'ORD', 'ORD-STR', 'ORD-STR-002']) {
      expect(prefixOfOrderNumber(v as string)).toBe('')
    }
  })

  it('the workstation reads the queue-derived prefix, not the raw business code', () => {
    expect(WS).toContain('const movePrefix = displayOrderPrefix(items, businessCode)')
    expect(WS).not.toContain('orderNumberPrefix(businessCode)')
  })

  it('the server sends the CANONICAL code, never LaundryBusiness.businessCode', () => {
    const API = read('src/app/api/laundry/processing/route.ts')
    expect(API).toContain('ensureBusinessCode(biz.platformBusinessId)')
    expect(API).toContain('businessCode: canonicalBusinessCode')
    // The laundry row is no longer asked for a business code.
    expect(API).not.toMatch(/laundryBusiness\.findUnique[\s\S]{0,120}businessCode:\s*true/)
  })
})
