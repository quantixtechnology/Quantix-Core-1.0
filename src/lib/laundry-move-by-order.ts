// ============================================================================
// MOVE BY ORDER — an additional fast track through Washing / Dry Cleaning.
//
// Scanning fifty garments one at a time is sometimes not worth the operator's
// morning. This lets them name an order, verify it on screen, and confirm that
// every garment is physically present — then the order advances.
//
// WHAT THIS IS NOT
//
// It is not a second state machine, and it does not fake a barcode scan.
//
// `processingStage` lives ONLY on LaundryOrderItem — LaundryOrder has no
// processing stage at all, and each workstation queue IS "the garments whose
// processingStage is this stage". So "moving an order" is not a flag that can
// be flipped somewhere else; it is, by definition, moving that order's garments.
// Garment-level state is therefore mandatory, not a workaround.
//
// The move is performed by the SAME canonical endpoint the scan gun drives —
// POST /api/laundry/items/[id]/process — with the same `expectedStage` guard,
// the same optimistic locking and the same LaundryItemEvent audit trail that a
// scanned garment produces. That is exactly what the existing multi-garment
// `bulkAdvance` already does; this reuses the pattern rather than inventing one.
//
// No LaundryItemEvent with action "SCAN" is ever written. The events are the
// real transition actions (START / COMPLETE), and each carries a note saying
// the operator confirmed the whole order — so the audit trail says what
// actually happened rather than pretending a barcode passed a reader.
// ============================================================================

/** The stages that offer the order-level fast track. Nothing else does. */
export const MOVE_BY_ORDER_STAGES = ["WASH", "DRYCLEAN"] as const
export type MoveByOrderStage = (typeof MOVE_BY_ORDER_STAGES)[number]

export interface MoveByOrderConfig {
  /** Button on the workstation, e.g. "Push to Wash". */
  pushLabel: string
  /** Confirmation dialog heading, e.g. "Push Order to Washing?". */
  modalTitle: string
  /** The stage-specific question, e.g. "…move this order to the Wash process?" */
  prompt: string
  /** Message when the order is not in THIS queue. */
  notFound: string
}

const CONFIG: Record<MoveByOrderStage, MoveByOrderConfig> = {
  WASH: {
    pushLabel: "Push Order to Wash",
    modalTitle: "Push Order to Washing?",
    prompt: "Do you want to move this order to the Wash process?",
    notFound: "Order not found in the Washing queue.",
  },
  DRYCLEAN: {
    pushLabel: "Push Order to Dry Clean",
    modalTitle: "Push Order to Dry Cleaning?",
    prompt: "Do you want to move this order to the Dry Clean process?",
    notFound: "Order not found in the Dry Cleaning queue.",
  },
}

/** The question the operator must answer before anything moves. */
export const MOVE_BY_ORDER_PROMPT =
  "Are you sure you have all the garments and want to push this order?"

/** Config for a stage, or null where the fast track is not offered. */
export function moveByOrderConfig(stage: string): MoveByOrderConfig | null {
  return CONFIG[stage as MoveByOrderStage] ?? null
}

export function supportsMoveByOrder(stage: string): boolean {
  return moveByOrderConfig(stage) !== null
}

/** A garment row as the processing queue returns it. */
export interface QueueGarment {
  id: string
  orderId: string
  orderNumber: string | null
  customer: string | null
  serviceId?: string | null
  serviceName: string | null
  processingStatus: string | null
  orderTotalWeightKg?: number | null
}

export interface QueueOrder {
  orderId: string
  orderNumber: string
  customer: string | null
  garments: QueueGarment[]
  totalWeightKg: number | null
}

/**
 * A garment this stage can still act on. DONE and REJECTED garments are still
 * returned by the queue endpoint but are finished here, so they are neither
 * counted nor moved.
 */
export function isMovable(g: { processingStatus: string | null }): boolean {
  return g.processingStatus === "WAITING" || g.processingStatus === "IN_PROGRESS" || g.processingStatus === "PAUSED"
}

/** Group the stage queue into orders. Only movable garments are included. */
export function ordersInQueue(items: readonly QueueGarment[] | null | undefined): QueueOrder[] {
  const byOrder = new Map<string, QueueOrder>()
  for (const g of items || []) {
    if (!g?.orderId || !isMovable(g)) continue
    const existing = byOrder.get(g.orderId)
    if (existing) {
      existing.garments.push(g)
      continue
    }
    byOrder.set(g.orderId, {
      orderId: g.orderId,
      orderNumber: g.orderNumber || "",
      customer: g.customer ?? null,
      garments: [g],
      totalWeightKg: g.orderTotalWeightKg ?? null,
    })
  }
  return [...byOrder.values()]
}

export type LookupResult =
  | { ok: true; order: QueueOrder }
  | { ok: false; error: string }

/**
 * Resolve a typed order number against the CURRENT stage queue.
 *
 * Deliberately scoped to what the workstation already holds: the queue is
 * fetched as `processingStage = <this stage>`, so an order that belongs to
 * another stage — a Dry Clean order typed into Washing, say — simply is not
 * here, and is refused with that stage's own message. No historical search, no
 * way to reach an arbitrary order. The server re-checks anyway via
 * `expectedStage`; this is the first of the two gates, not the only one.
 *
 * Matching is forgiving about case, surrounding whitespace and the long
 * ORD-STR-BUS-… prefix an operator would rather not retype in full: a unique
 * suffix match is accepted, an ambiguous one is refused rather than guessed.
 */
export function findOrderInQueue(
  items: readonly QueueGarment[] | null | undefined,
  query: string,
  stage: string,
): LookupResult {
  const cfg = moveByOrderConfig(stage)
  const notFound = cfg?.notFound ?? "Order not found in this queue."

  const q = String(query || "").trim().toUpperCase()
  if (!q) return { ok: false, error: "Enter a Store / Order number." }

  const orders = ordersInQueue(items)
  const exact = orders.filter((o) => o.orderNumber.toUpperCase() === q)
  if (exact.length === 1) return { ok: true, order: exact[0] }

  const partial = orders.filter((o) => o.orderNumber.toUpperCase().endsWith(q) || o.orderNumber.toUpperCase().includes(q))
  if (partial.length === 1) return { ok: true, order: partial[0] }
  if (partial.length > 1) {
    return { ok: false, error: `${partial.length} orders in this queue match "${query.trim()}" — enter more of the number.` }
  }
  return { ok: false, error: notFound }
}

export interface PlannedMove {
  itemId: string
  /** START first when the garment is only waiting; COMPLETE does the move. */
  actions: ("START" | "RESUME" | "COMPLETE")[]
}

/**
 * The canonical calls that advance one order's garments through this stage.
 *
 * COMPLETE is refused by the server unless the garment is IN_PROGRESS, which is
 * why a waiting garment is started first — the same two steps the operator
 * performs with a scanner, issued in the same order against the same endpoint.
 * A paused garment is resumed rather than started, matching the endpoint's own
 * rules. Nothing here decides whether the move is allowed; the server does.
 */
export function planOrderMove(order: QueueOrder): PlannedMove[] {
  return order.garments.filter(isMovable).map((g) => ({
    itemId: g.id,
    actions:
      g.processingStatus === "IN_PROGRESS"
        ? ["COMPLETE"]
        : g.processingStatus === "PAUSED"
          ? ["RESUME", "COMPLETE"]
          : ["START", "COMPLETE"],
  }))
}

/**
 * The note written onto every LaundryItemEvent this move produces.
 *
 * The audit trail must not read as though fifty barcodes were scanned. It says
 * an operator asserted the order was complete, and names them.
 */
export function moveByOrderNote(orderNumber: string, actorName?: string | null): string {
  const who = String(actorName || "").trim()
  return `Moved by order ${orderNumber} — operator confirmed all garments present${who ? ` (${who})` : ""}`
}

// ── Progress + outcome ──────────────────────────────────────────────────────
//
// A 50- or 100-garment order is moved one garment at a time, and that is fine:
// there is no cap here and none anywhere else. What the operator must never be
// told is that the order moved when only part of it did, so "complete" is
// defined once, in one place, and it means EVERY eligible garment advanced.

export interface MoveProgress {
  /** Garments that finished their transition. */
  done: number
  /** Garments that failed, conflicted, or became ineligible mid-run. */
  failed: number
  /** Eligible garments this run set out to move. */
  total: number
}

/** "Moving 27 of 50 items" — shown while the run is in flight. */
export function moveProgressLabel(p: MoveProgress, direction: "forward" | "back" = "forward"): string {
  const verb = direction === "back" ? "Moving back" : "Moving"
  return `${verb} ${Math.min(p.done + p.failed, p.total)} of ${p.total} item${p.total === 1 ? "" : "s"}`
}

/** The instruction that must stay on screen for the whole run. */
export const MOVE_WAIT_NOTICE = "Please wait until all items are moved."

export interface MoveOutcome {
  /** TRUE only when every eligible garment moved. Nothing else counts. */
  complete: boolean
  title: string
  description: string
}

/**
 * Judge a finished run.
 *
 * The only success is total: `failed === 0` AND every eligible garment
 * accounted for. A run that moved 27 of 50 is a partial move and says so,
 * naming what is left behind — the queue is reloaded either way, because the
 * server is the authority on what actually happened.
 */
export function moveOutcome(p: MoveProgress, direction: "forward" | "back" = "forward"): MoveOutcome {
  const moved = direction === "back" ? "moved back" : "moved"
  if (p.total === 0) {
    return { complete: false, title: "Nothing to move", description: "No eligible garments remain in this queue for that order." }
  }
  if (p.failed === 0 && p.done === p.total) {
    return {
      complete: true,
      title: `Order ${moved} — all ${p.total} item${p.total === 1 ? "" : "s"}`,
      description: `Every eligible garment ${moved}.`,
    }
  }
  return {
    complete: false,
    title: `Order NOT fully ${moved} — ${p.done} of ${p.total} item${p.total === 1 ? "" : "s"}`,
    description:
      `${p.failed} item${p.failed === 1 ? "" : "s"} could not be ${moved} (another operator may have moved ${p.failed === 1 ? "it" : "them"}, or ${p.failed === 1 ? "it is" : "they are"} no longer eligible). ` +
      `The queue has been reloaded — check the remaining items and retry.`,
  }
}

// ── The order-number prefix an operator should never have to retype ─────────
//
// generateOrderNumber() builds a number as
//
//     ORD - STR - BUS-YYYYMM-NNNN - NNN    - NNNNNN
//      │     │          │            │        └ order sequence   (6)
//      │     │          │            └───────── store sequence   (3)
//      │     │          └────────────────────── canonical business code
//      │     └───────────────────────────────── CODES.STORE_PREFIX
//      └─────────────────────────────────────── CODES.ORDER_PREFIX
//
// (orderNumber = `ORD-${storeCode}-${seq}` and storeCode = `STR-${businessCode}-${seq}`)
//
// Everything up to and including the business code is fixed for a workstation,
// so it is shown as a fixed adornment and the operator types only the two parts
// that vary: "002-000005". Nothing here is hardcoded — the business code comes
// from the queue response, and the two literals mirror CODES in laundry-codes.

/** Mirrors CODES.ORDER_PREFIX / CODES.STORE_PREFIX in @/lib/laundry-codes. */
export const ORDER_CODE_PREFIX = "ORD"
export const STORE_CODE_PREFIX = "STR"

/**
 * The fixed part of every order number in this business, ending in "-".
 * Returns "" when the business code is not known yet, so the UI can fall back
 * to a plain full-number field rather than showing a wrong prefix.
 */
export function orderNumberPrefix(businessCode: string | null | undefined): string {
  const code = String(businessCode || "").trim().toUpperCase()
  if (!code) return ""
  return `${ORDER_CODE_PREFIX}-${STORE_CODE_PREFIX}-${code}-`
}

/**
 * Join the fixed prefix with what the operator typed.
 *
 * Tolerant of the three things operators actually do: type just the varying
 * part ("002-000005"), paste a whole order number, or paste one with stray
 * spaces or lower case. A pasted full number is used as-is rather than being
 * concatenated onto the prefix twice.
 */
export function composeOrderNumber(prefix: string, typed: string): string {
  const t = String(typed || "").trim().toUpperCase().replace(/\s+/g, "")
  if (!t) return ""
  const p = String(prefix || "").trim().toUpperCase()
  if (!p) return t
  if (t.startsWith(p)) return t
  // A full number pasted from elsewhere (possibly another business/month).
  if (t.startsWith(`${ORDER_CODE_PREFIX}-`)) return t
  return `${p}${t.replace(/^-+/, "")}`
}

/** "002-000005" — what the operator is expected to type. */
export const ORDER_SUFFIX_PLACEHOLDER = "002-000005"

/**
 * The prefix implied by an order number that is ACTUALLY in the queue.
 *
 * An order number is `ORD-STR-{businessCode}-{storeSeq}-{orderSeq}` and the two
 * sequences are always the last two dash-separated segments, whatever shape the
 * business code has. Dropping them leaves exactly the fixed part.
 *
 * Returns "" for anything that is not shaped like an order number.
 */
export function prefixOfOrderNumber(orderNumber: string | null | undefined): string {
  const n = String(orderNumber || "").trim().toUpperCase()
  if (!n) return ""
  const parts = n.split("-")
  // ORD, STR, …business code (>=1 part)…, storeSeq, orderSeq
  if (parts.length < 4) return ""
  return `${parts.slice(0, parts.length - 2).join("-")}-`
}

/**
 * The prefix the workstation should display, derived from the queue itself.
 *
 * This is the safeguard against showing a prefix the queue would never match:
 * the business code is read from one place and the order numbers were minted
 * from another, and those two disagreed once already (LaundryBusiness carries a
 * retired LND-… code while order numbers embed the canonical BUS-… one).
 *
 * So the ORDERS decide. When every order in this queue shares one prefix, that
 * is what the operator sees, and typing "002-000005" is guaranteed to resolve.
 * A queue spanning stores of different eras yields no single answer, and an
 * empty queue has nothing to say — both fall back to the canonical business
 * code, which is the correct source for a queue with nothing in it yet.
 */
export function displayOrderPrefix(
  items: readonly QueueGarment[] | null | undefined,
  canonicalBusinessCode: string | null | undefined,
): string {
  const seen = new Set<string>()
  for (const g of items || []) {
    const p = prefixOfOrderNumber(g?.orderNumber)
    if (p) seen.add(p)
    if (seen.size > 1) break
  }
  if (seen.size === 1) return [...seen][0]
  return orderNumberPrefix(canonicalBusinessCode)
}
