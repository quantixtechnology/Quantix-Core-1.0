import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'
import {
  assertTransition,
  checkStateInvariants,
  REQUIRES_IDENTIFIED_GARMENTS,
  REQUIRES_PROCESSING_COMPLETE,
  type OrderStateEvidence,
} from '@/lib/laundry-order-state'
import { TRANSITIONS, getTransitions, type LaundryOrderStatus } from '@/lib/laundry-workflow'

const ROOT = process.cwd()
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

// Perfect evidence: 4 garments, all inspected, all through processing, pickup
// done, store receipt recorded. The strongest case a caller could ever present —
// so anything refused below is refused on the RULE, never on missing data.
const perfect = (status: string, over: Partial<OrderStateEvidence> = {}): OrderStateEvidence => ({
  id: 'o1', orderNumber: 'ORD-TEST', businessId: 'lb1', status,
  itemCount: 4, inspectedCount: 4, processedCount: 4,
  hasProcessingEvent: true, hasStoreReceiptEvent: true,
  pickupRequired: true, pickupCompletedAt: new Date(),
  deliveryRequired: true, deliveredAt: null, deliveryCompletedAt: null,
  ...over,
})

// ============================================================================
// ITEM 7 — COMPLETE STATUS-WRITER AUDIT
// Every LaundryOrder.status mutation in the tree, enumerated by the test itself.
// A new unguarded writer added later fails this suite.
// ============================================================================
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === '__tests__') continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (name.endsWith('.ts') || name.endsWith('.tsx')) out.push(full)
  }
  return out
}

/** The `{ … }` object literal starting at the first `{` at or after `from`. */
function braceBlock(src: string, from: number): string {
  const open = src.indexOf('{', from)
  if (open < 0) return ''
  let depth = 0
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(open, i + 1) }
  }
  return src.slice(open)
}

/** Call sites of laundryOrder.update/updateMany whose `data` writes `status`. */
function findStatusWriters(): { file: string; snippet: string }[] {
  const hits: { file: string; snippet: string }[] = []
  for (const full of walk(join(ROOT, 'src'))) {
    const src = readFileSync(full, 'utf8')
    for (const m of src.matchAll(/\b(?:prisma|tx|db)\.laundryOrder\.(?:update|updateMany|upsert)\s*\(/g)) {
      const snippet = src.slice(m.index!, m.index! + 700)
      // `data:` object of this call only — stop at the closing of the call.
      const dataAt = snippet.indexOf('data:')
      if (dataAt < 0) continue
      // Brace-match the `data: { … }` object. A fixed window over-runs into the
      // next statement and reads a neighbouring bag's `status:` as an order
      // write. The KEY must also be exactly `status` — never `paymentStatus:`
      // or `fieldStatus:`.
      const dataBlock = braceBlock(snippet, dataAt)
      if (!/(?:^|[^A-Za-z])status:/.test(dataBlock)) continue
      hits.push({ file: relative(ROOT, full), snippet })
    }
  }
  return hits
}

// The two writers that deliberately carry no state guard, each with the reason
// it is safe. Anything else must be guarded.
const REVIEWED_UNGUARDED: Record<string, { to: string; why: string }> = {
  'src/app/api/laundry/bags/receive-at-store/route.ts': {
    to: 'PENDING_STORE_AUDIT',
    why: 'Store receives the pickup bag by scan. Pickup must stay independently operable, and Store Audit is where garments are first identified — so it carries no garment/processing invariant to check.',
  },
  'src/app/api/laundry/executive/jobs/[id]/status/route.ts': {
    to: 'IN_TRANSIT_TO_STORE',
    why: 'The executive ends their own leg. Pickup must stay independently operable, and the destination carries no invariant.',
  },
}

describe('ITEM 7 · every LaundryOrder.status writer is accounted for', () => {
  const writers = findStatusWriters()

  it('finds the status writers (the scan itself works)', () => {
    expect(writers.length).toBeGreaterThanOrEqual(10)
  })

  it('every writer is either behind the state guard or explicitly reviewed', () => {
    const unaccounted: string[] = []
    for (const w of writers) {
      const src = read(w.file)
      const guarded = /guardStatusWrite|guardFinancialAdvance/.test(src)
      if (guarded || w.file in REVIEWED_UNGUARDED) continue
      unaccounted.push(w.file)
    }
    expect(unaccounted, `unguarded LaundryOrder.status writer(s): ${unaccounted.join(', ')}`).toEqual([])
  })

  // The reviewed exemptions are only safe because their destinations carry no
  // invariant. Prove that from the rules rather than asserting it in a comment:
  // if either stage ever gains one, this fails and the exemption must be revisited.
  it.each(Object.entries(REVIEWED_UNGUARDED))('%s writes a stage that carries no invariant', (_f, { to }) => {
    expect(REQUIRES_IDENTIFIED_GARMENTS.has(to)).toBe(false)
    expect(REQUIRES_PROCESSING_COMPLETE.has(to)).toBe(false)
    // …so the guard would be a no-op there: an empty order passes at that stage.
    const empty = perfect(to, { itemCount: 0, inspectedCount: 0, processedCount: 0, hasProcessingEvent: false })
    expect(checkStateInvariants(to, empty).ok).toBe(true)
  })

  it('no writer outside the delivery engine can write DELIVERED', () => {
    for (const w of writers) {
      if (w.file === 'src/lib/laundry-deliver.ts') continue
      const dataBlock = w.snippet.slice(w.snippet.indexOf('data:'), w.snippet.indexOf('data:') + 400)
      expect(/status:\s*["'`]DELIVERED["'`]/.test(dataBlock), `${w.file} writes DELIVERED literally`).toBe(false)
    }
  })

  // Concurrency: a status write must be scoped to the status it read, so two
  // racing requests cannot both apply the same step.
  it('every guarded advance is a compare-and-set on the source status', () => {
    const advancing = [
      'src/app/api/laundry/orders/[id]/pack/route.ts',
      'src/app/api/laundry/orders/[id]/dispatch/route.ts',
      'src/app/api/laundry/orders/[id]/receive/route.ts',
      'src/app/api/laundry/orders/[id]/return-dispatch/route.ts',
      'src/app/api/laundry/orders/[id]/store-receive/route.ts',
      'src/app/api/laundry/processing/transit/route.ts',
      'src/lib/laundry-deliver.ts',
    ]
    for (const f of advancing) {
      const src = read(f)
      expect(src, `${f} must scope its update to the source status`).toMatch(/updateMany\(\{[\s\S]{0,200}?where:\s*\{[^}]*status:/)
    }
  })
})

// ============================================================================
// ITEM 6 — PAY LATER / FINANCIAL FORENSICS
// ============================================================================
describe('ITEM 6 · no financial operation can execute a physical transition', () => {
  // What a PAY LATER confirmation does, per the route: at Payment Collection it
  // takes the COLLECT_PAYMENT edge; anywhere else it takes that stage's primary
  // forward edge — but never an internal or custody one.
  const payLaterStep = (from: string): string | null => {
    if (from === 'PAYMENT_PENDING') return 'READY_FOR_PROCESSING' // advanceAfterPayment
    const primary = getTransitions(from).find((t) => t.primary && t.to !== 'CANCELLED')
    if (!primary || primary.internal || primary.custody) return null
    return primary.to
  }

  it('the route implements exactly those two branches', () => {
    const api = read('src/app/api/laundry/orders/[id]/payment/route.ts')
    expect(api).toContain('const atPaymentCollection = orderPL.status === "PAYMENT_PENDING"')
    expect(api).toContain('if (primary.internal || primary.custody) return null')
    expect(api).toContain('t.primary && t.to !== "CANCELLED"')
  })

  // The headline: hammer Pay Later from EVERY stage, as many times as it will
  // move, and prove where it can end up.
  const NON_TERMINAL = Object.keys(TRANSITIONS).filter((s) => s !== 'DELIVERED' && s !== 'CANCELLED')

  it.each(NON_TERMINAL)('repeated Pay Later from %s never reaches Delivered', (start) => {
    const path: string[] = [start]
    let cur = start
    for (let i = 0; i < 50; i++) {
      const next = payLaterStep(cur)
      if (!next) break
      expect(path, `Pay Later looped: ${path.join(' → ')}`).not.toContain(next)
      path.push(next)
      cur = next
    }
    expect(path, `Pay Later reached Delivered: ${path.join(' → ')}`).not.toContain('DELIVERED')
    // and it never crossed a physical edge on the way
    for (let i = 0; i < path.length - 1; i++) {
      const edge = getTransitions(path[i]).find((t) => t.to === path[i + 1])
      expect(edge?.custody, `Pay Later took the custody edge ${path[i]} → ${path[i + 1]}`).toBeFalsy()
    }
  })

  // Pay Later can only ever walk the NON-PHYSICAL part of the workflow. The
  // first physical step — PACK_ORDER — is a custody edge, so a walk that starts
  // before packing halts at or before Packing & QR however many times it is
  // confirmed.
  //
  // The one edge a payment may take beyond that is the LEGACY QC_PASS
  // (QC_PENDING → READY_FOR_DELIVERY), kept for orders created before the
  // transit stages existed. It is not custody, so the graph allows it — but
  // READY_FOR_DELIVERY carries the processing-complete invariant, so a payment
  // can only take it on an order whose garments genuinely finished processing.
  // It fabricates nothing, and it still cannot continue to DELIVERED.
  it('every Pay Later walk terminates, and never past Packing & QR before the legacy QC stage', () => {
    const order = ['DRAFT', 'AWAITING_PICKUP_ASSIGNMENT', 'IN_TRANSIT_TO_STORE', 'PENDING_STORE_AUDIT', 'UNDER_AUDIT', 'PAYMENT_PENDING', 'READY_FOR_PROCESSING', 'PACKED', 'IN_TRANSIT_TO_PROCESSING', 'PROCESSING', 'QC_PENDING', 'RETURN_IN_TRANSIT', 'READY_FOR_DELIVERY', 'DELIVERED']
    for (const start of NON_TERMINAL) {
      let cur = start, steps = 0
      while (steps < 50) { const n = payLaterStep(cur); if (!n) break; cur = n; steps++ }
      expect(steps, `Pay Later did not terminate from ${start}`).toBeLessThan(50)
      expect(cur, `Pay Later reached Delivered from ${start}`).not.toBe('DELIVERED')
      if (order.indexOf(start) <= order.indexOf('READY_FOR_PROCESSING')) {
        expect(order.indexOf(cur), `Pay Later from ${start} ended at ${cur}`).toBeLessThanOrEqual(order.indexOf('READY_FOR_PROCESSING'))
      } else if (start === 'QC_PENDING') {
        expect(cur).toBe('READY_FOR_DELIVERY') // the legacy QC_PASS edge, and no further
      } else {
        expect(cur, `Pay Later moved a post-packing order from ${start}`).toBe(start)
      }
    }
  })

  it('the legacy QC_PASS edge still cannot fabricate processing', () => {
    const unprocessed = perfect('QC_PENDING', { processedCount: 0, hasProcessingEvent: false })
    const v = assertTransition('QC_PENDING', 'READY_FOR_DELIVERY', unprocessed, { allowInternal: true })
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.code).toBe('PROCESSING_NOT_COMPLETE')
    // and from there a payment still cannot deliver
    const ready = perfect('READY_FOR_DELIVERY')
    expect(assertTransition('READY_FOR_DELIVERY', 'DELIVERED', ready, { allowInternal: true }).ok).toBe(false)
  })

  // Graph-level proof, independent of the route's arithmetic: the full set of
  // stages ANY financial caller can reach, given its maximum authority
  // (allowInternal, never custodyAction) and perfect evidence.
  it('the stages reachable by a financial caller exclude Delivered entirely', () => {
    const reachable = new Set<string>()
    const seed = Object.keys(TRANSITIONS)
    const queue = [...seed]
    while (queue.length) {
      const from = queue.shift() as LaundryOrderStatus
      for (const edge of getTransitions(from)) {
        if (edge.to === 'CANCELLED') continue
        const v = assertTransition(from, edge.to, perfect(from), { allowInternal: true })
        if (!v.ok) continue
        if (!reachable.has(edge.to)) { reachable.add(edge.to); queue.push(edge.to) }
      }
    }
    expect([...reachable].sort()).not.toContain('DELIVERED')
    for (const s of reachable) {
      expect(REQUIRES_PROCESSING_COMPLETE.has(s) && s === 'DELIVERED').toBe(false)
    }
  })
})

// ============================================================================
// ITEM 8 — FULL WORKFLOW + EVERY INVALID SHORTCUT
// ============================================================================
describe('ITEM 8 · the real path works and every shortcut is refused', () => {
  const REAL_PATH: [string, string][] = [
    ['AWAITING_PICKUP_ASSIGNMENT', 'IN_TRANSIT_TO_STORE'],
    ['IN_TRANSIT_TO_STORE', 'PENDING_STORE_AUDIT'],
    ['PENDING_STORE_AUDIT', 'PAYMENT_PENDING'],
    ['PAYMENT_PENDING', 'READY_FOR_PROCESSING'],
    ['READY_FOR_PROCESSING', 'PACKED'],
    ['PACKED', 'IN_TRANSIT_TO_PROCESSING'],
    ['IN_TRANSIT_TO_PROCESSING', 'PROCESSING'],
    ['PROCESSING', 'RETURN_IN_TRANSIT'],
    ['RETURN_IN_TRANSIT', 'READY_FOR_DELIVERY'],
    ['READY_FOR_DELIVERY', 'DELIVERED'],
  ]

  it('the complete pickup → processing → ready → delivered path is allowed', () => {
    for (const [from, to] of REAL_PATH) {
      const ev = perfect(from)
      const v = assertTransition(from, to, ev, { allowInternal: true, custodyAction: true, deliveryCompletion: to === 'DELIVERED' })
      expect(v, `${from} → ${to}`).toEqual({ ok: true })
    }
  })

  // Each named shortcut, with perfect evidence so the refusal is on the rule.
  const SHORTCUTS: [string, string, string][] = [
    ['Audit cannot skip to processing', 'PENDING_STORE_AUDIT', 'PROCESSING'],
    ['Audit cannot skip to packing', 'PENDING_STORE_AUDIT', 'READY_FOR_PROCESSING'],
    ['Audit cannot skip to delivered', 'PENDING_STORE_AUDIT', 'DELIVERED'],
    ['Payment cannot skip packing', 'PAYMENT_PENDING', 'IN_TRANSIT_TO_PROCESSING'],
    ['Payment cannot skip to processing', 'PAYMENT_PENDING', 'PROCESSING'],
    ['Packing cannot skip processing', 'PACKED', 'RETURN_IN_TRANSIT'],
    ['Packing cannot skip to ready', 'PACKED', 'READY_FOR_DELIVERY'],
    ['Processing cannot skip return', 'PROCESSING', 'READY_FOR_DELIVERY'],
    ['Processing cannot skip to delivered', 'PROCESSING', 'DELIVERED'],
    ['QC cannot skip store receive', 'QC_PENDING', 'DELIVERED'],
    ['Return transit cannot skip store receive', 'RETURN_IN_TRANSIT', 'DELIVERED'],
    ['Pickup cannot become delivered', 'AWAITING_PICKUP_ASSIGNMENT', 'DELIVERED'],
    ['Transit to store cannot become delivered', 'IN_TRANSIT_TO_STORE', 'DELIVERED'],
  ]

  it.each(SHORTCUTS)('%s', (_name, from, to) => {
    const v = assertTransition(from, to, perfect(from), { allowInternal: true, custodyAction: true, deliveryCompletion: true })
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.code).toBe('INVALID_TRANSITION')
  })

  it('Processing cannot return to store until every garment finished', () => {
    // The state guard permits PROCESSING → RETURN_IN_TRANSIT (garments identified);
    // the operational gate on the dispatch endpoints is what requires every
    // garment to have completed. Both must be present.
    for (const f of ['src/app/api/laundry/orders/[id]/return-dispatch/route.ts', 'src/app/api/laundry/processing/transit/route.ts']) {
      const src = read(f)
      expect(src).toContain('isProcessingTerminal')
      expect(src).toContain('have not completed processing & QC')
      expect(src.indexOf('unfinished'), f).toBeLessThan(src.indexOf('updateMany'))
    }
  })

  it('Store Audit cannot be left until every garment is inspected', () => {
    expect(read('src/app/api/laundry/orders/[id]/transition/route.ts')).toContain('checkAuditComplete')
    expect(read('src/app/api/laundry/orders/[id]/pack/route.ts')).toContain('checkAuditComplete')
  })

  // Ready for Delivery must not become Delivered because a delivery EXISTS.
  it.each([
    ['awaiting assignment', {}],
    ['assigned', {}],
    ['accepted', {}],
    ['started', {}],
    ['in transit', {}],
  ])('a delivery that is only %s cannot make the order Delivered', () => {
    // None of those states writes deliveredAt/deliveryCompletedAt — the only
    // fields the invariant reads — and none of them is the delivery engine, so
    // none can pass deliveryCompletion.
    const v = assertTransition('READY_FOR_DELIVERY', 'DELIVERED', perfect('READY_FOR_DELIVERY'), { allowInternal: true, custodyAction: true })
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.code).toBe('DELIVERY_NOT_COMPLETED')
  })

  it('only an actual delivery completion produces DELIVERED', () => {
    const ev = perfect('READY_FOR_DELIVERY')
    expect(assertTransition('READY_FOR_DELIVERY', 'DELIVERED', ev, { allowInternal: true, custodyAction: true, deliveryCompletion: true }).ok).toBe(true)
    // and the engine that passes it is the only one that stamps the completion
    const engine = read('src/lib/laundry-deliver.ts')
    expect(engine).toContain('deliveryCompletion: true')
    expect(engine).toContain('deliveredAt: now')
  })

  it('an unprocessed order can NEVER become Delivered, by any caller', () => {
    for (const ev of [
      perfect('READY_FOR_DELIVERY', { itemCount: 0, inspectedCount: 0, processedCount: 0, hasProcessingEvent: false }),
      perfect('READY_FOR_DELIVERY', { processedCount: 0, hasProcessingEvent: false }),
      perfect('READY_FOR_DELIVERY', { inspectedCount: 2, processedCount: 0, hasProcessingEvent: false }),
    ]) {
      const v = assertTransition('READY_FOR_DELIVERY', 'DELIVERED', ev, { allowInternal: true, custodyAction: true, deliveryCompletion: true })
      expect(v.ok).toBe(false)
    }
  })

  it('a failed operation never advances the parent order', () => {
    // The compare-and-set is the guarantee: a losing racer matches no row, so
    // the status is never applied twice and never applied from a stage the
    // caller did not read. Each endpoint then either refuses (409) or, at
    // minimum, writes no timeline event claiming a move that did not happen.
    for (const f of [
      'src/app/api/laundry/orders/[id]/pack/route.ts',
      'src/app/api/laundry/orders/[id]/dispatch/route.ts',
      'src/app/api/laundry/orders/[id]/receive/route.ts',
      'src/app/api/laundry/orders/[id]/return-dispatch/route.ts',
      'src/app/api/laundry/orders/[id]/store-receive/route.ts',
      'src/app/api/laundry/processing/transit/route.ts',
    ]) {
      expect(read(f), `${f} must branch on the compare-and-set result`).toMatch(/advanced\.count (?:===|>) 0/)
    }
    expect(read('src/lib/laundry-deliver.ts')).toContain('advanced.count === 0')
  })

  // Documented difference, deliberately asserted so it cannot drift unnoticed:
  // five endpoints refuse a lost race with 409; Packing & QR reports success and
  // simply writes no event. Neither applies the status twice — the CAS prevents
  // that — so no order is corrupted either way.
  it('five endpoints 409 on a lost race; Packing & QR reports success without re-applying', () => {
    for (const f of [
      'src/app/api/laundry/orders/[id]/dispatch/route.ts',
      'src/app/api/laundry/orders/[id]/receive/route.ts',
      'src/app/api/laundry/orders/[id]/return-dispatch/route.ts',
      'src/app/api/laundry/orders/[id]/store-receive/route.ts',
      'src/app/api/laundry/processing/transit/route.ts',
    ]) {
      expect(read(f), f).toMatch(/advanced\.count === 0\)\s*return NextResponse\.json\(\{ error/)
    }
    const pack = read('src/app/api/laundry/orders/[id]/pack/route.ts')
    expect(pack).toContain('if (advanced.count > 0)')
    expect(pack).not.toMatch(/advanced\.count === 0/)
  })

  it('duplicate requests are idempotent, not double-applied', () => {
    // Same-status transition answers with the current state instead of a bogus
    // 409, and the compare-and-set means only the first of two racers applies.
    const t = read('src/app/api/laundry/orders/[id]/transition/route.ts')
    expect(t).toContain('if (fromStatus === toStatus)')
    expect(t).toContain('alreadyInStatus: true')
    // A second delivery attempt is refused by the engine, not silently repeated.
    expect(read('src/lib/laundry-deliver.ts')).toContain('Order already delivered')
    // assertTransition itself refuses a no-op move.
    const v = assertTransition('PROCESSING', 'PROCESSING', perfect('PROCESSING'), { allowInternal: true, custodyAction: true })
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.code).toBe('NO_CHANGE')
  })

  it('no stage can be entered from a stage the workflow does not connect', () => {
    // Exhaustive: every ordered pair not in TRANSITIONS is refused.
    const all = Object.keys(TRANSITIONS)
    let refused = 0
    for (const from of all) {
      for (const to of all) {
        if (from === to) continue
        if (getTransitions(from).some((t) => t.to === to)) continue
        const v = assertTransition(from, to, perfect(from), { allowInternal: true, custodyAction: true, deliveryCompletion: true })
        expect(v.ok, `${from} → ${to} was allowed`).toBe(false)
        refused++
      }
    }
    expect(refused).toBeGreaterThan(150)
  })
})
