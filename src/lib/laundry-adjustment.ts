// Customer compensation / goodwill — the arithmetic, in one place.
//
// The rule that matters: an adjustment NEVER edits the invoice. grandTotal and
// every LaundryPayment row are historical facts. What an adjustment changes is
// what is still OWED, and what is owed BACK:
//
//   money already paid   → the adjustment becomes refundable
//   money still due      → the adjustment reduces the balance
//
// A ₹100 adjustment on a ₹500 invoice with ₹500 paid is a ₹100 refund due, not
// a ₹400 invoice. A ₹100 adjustment on the same invoice with nothing paid makes
// ₹400 payable, and the invoice is still ₹500.

export const ADJUSTMENT_REASONS = [
  { value: "EXPRESS_DELAY", label: "Express delivery delayed" },
  { value: "SERVICE_ISSUE", label: "Service issue" },
  { value: "GARMENT_ISSUE", label: "Garment issue" },
  { value: "COMPLAINT", label: "Customer complaint" },
  { value: "GOODWILL", label: "Goodwill" },
  { value: "OTHER", label: "Other" },
] as const

export type AdjustmentReason = (typeof ADJUSTMENT_REASONS)[number]["value"]
export type RefundStatus = "NOT_REQUIRED" | "PENDING" | "PROCESSING" | "REFUNDED" | "FAILED"

export const REFUND_LABEL: Record<RefundStatus, string> = {
  NOT_REQUIRED: "Applied to balance",
  PENDING: "Refund Pending",
  PROCESSING: "Refund Processing",
  REFUNDED: "Refunded",
  FAILED: "Refund Failed",
}

/** Money already handed back. Only a completed refund counts. */
export const isSettled = (s: string) => s === "REFUNDED"

export function reasonLabel(value: string): string {
  return ADJUSTMENT_REASONS.find((r) => r.value === value)?.label ?? value
}

export interface OrderMoney {
  grandTotal: number
  amountPaid: number
  balanceDue: number
}

export interface AdjustmentRow {
  amount: number
  appliedToDue: number
  refundable: number
  refundStatus: string
}

/**
 * How a NEW adjustment splits.
 *
 * Paid money can only come back as a refund; unpaid money is simply not
 * collected. Refundable is capped by what has actually been paid MINUS what
 * earlier adjustments already claimed, so two ₹100 adjustments on a ₹100
 * payment cannot promise ₹200 back.
 */
export function splitAdjustment(money: OrderMoney, existing: AdjustmentRow[], amount: number) {
  const alreadyRefundable = existing.reduce((s, a) => s + (a.refundable || 0), 0)
  const claimablePaid = Math.max(0, round2(money.amountPaid - alreadyRefundable))
  const refundable = Math.min(round2(amount), claimablePaid)
  const appliedToDue = round2(amount - refundable)
  return { refundable, appliedToDue }
}

/**
 * The most that may still be given away: everything not already compensated.
 * Prevents a negative payable and prevents refunding more than was taken.
 */
export function maxCompensation(money: OrderMoney, existing: AdjustmentRow[]): number {
  const given = existing.reduce((s, a) => s + (a.amount || 0), 0)
  return Math.max(0, round2(money.amountPaid + money.balanceDue - given))
}

export interface CompensationSummary {
  invoiceTotal: number
  paid: number
  compensation: number
  refundDue: number
  refunded: number
  balance: number
}

/** The five figures the Payment & Adjustments panel shows. */
export function summarise(money: OrderMoney, adjustments: AdjustmentRow[]): CompensationSummary {
  const compensation = round2(adjustments.reduce((s, a) => s + (a.amount || 0), 0))
  const refunded = round2(adjustments.filter((a) => isSettled(a.refundStatus)).reduce((s, a) => s + (a.refundable || 0), 0))
  const refundDue = round2(adjustments.filter((a) => !isSettled(a.refundStatus)).reduce((s, a) => s + (a.refundable || 0), 0))
  return {
    // Unchanged, always. The invoice is what it was.
    invoiceTotal: round2(money.grandTotal),
    paid: round2(money.amountPaid),
    compensation,
    refundDue,
    refunded,
    balance: round2(money.balanceDue),
  }
}

export function validateCompensation(money: OrderMoney, existing: AdjustmentRow[], amount: number): string | null {
  if (!Number.isFinite(amount) || amount <= 0) return "Enter an amount greater than zero."
  const max = maxCompensation(money, existing)
  if (max <= 0) return "This order has already been fully compensated."
  if (round2(amount) > max) return `Compensation cannot exceed ₹${max.toFixed(2)} for this order.`
  return null
}

/** Refunds move forward only; a completed refund is never un-completed here. */
export function canRefund(status: string): boolean {
  return status === "PENDING" || status === "FAILED"
}

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100
}

// ── Discounts: manual and scheme ────────────────────────────────────────────
// A discount and a compensation are the same financial event — money given back
// to the customer — so they share one table and one split rule. Only the label
// and how the amount was DERIVED differ.

export type AdjustmentKind = "COMPENSATION" | "MANUAL_DISCOUNT" | "SCHEME_DISCOUNT"
export type DiscountType = "FIXED" | "PERCENT"

export const KIND_LABEL: Record<AdjustmentKind, string> = {
  COMPENSATION: "Customer Compensation",
  MANUAL_DISCOUNT: "Manual Discount",
  SCHEME_DISCOUNT: "Scheme Discount",
}

/** What a promotion is worth on a given order value, honouring its cap. */
export function discountAmount(type: string, value: number, orderValue: number, maxDiscount?: number | null): number {
  const v = Number(value) || 0
  const raw = type === "PERCENT" ? (orderValue * v) / 100 : v
  const capped = maxDiscount != null && maxDiscount > 0 ? Math.min(raw, maxDiscount) : raw
  // Never more than the order is worth, and never negative.
  return Math.max(0, Math.round(Math.min(capped, orderValue) * 100) / 100)
}

export interface SchemeLike {
  status?: string | null
  enabled?: boolean | null
  startAt?: Date | string | null
  endAt?: Date | string | null
  minOrderValue?: number | null
}

/**
 * Why a scheme cannot be used right now, or null when it can. Mirrors the
 * conditions the Promotion model already stores — it does not invent new ones.
 */
export function schemeRefusal(p: SchemeLike, orderValue: number, now: Date = new Date()): string | null {
  if (p.enabled === false) return "This scheme is switched off."
  if (p.status && !["ACTIVE", "SCHEDULED"].includes(p.status)) return `This scheme is ${String(p.status).toLowerCase()}.`
  if (p.startAt && new Date(p.startAt) > now) return "This scheme has not started yet."
  if (p.endAt && new Date(p.endAt) < now) return "This scheme has expired."
  if (p.minOrderValue != null && orderValue < p.minOrderValue) return `This scheme needs a minimum order of ₹${p.minOrderValue}.`
  return null
}

export interface LedgerMoney extends OrderMoney {
  subscriptionCoveredAmount?: number
  discount?: number
}

export interface FinancialSummary {
  invoiceTotal: number
  subscriptionCovered: number
  discount: number
  netPayable: number
  paid: number
  refunded: number
  refundDue: number
  balance: number
}

/**
 * The Financial Summary block.
 *
 * Subscription coverage and discounts are kept apart on purpose: coverage is
 * allowance the customer already owns, a discount is money the business gives
 * up. Netting them together would make an allowance look like a price cut and
 * hide which one actually moved.
 */
export function financialSummary(money: LedgerMoney, adjustments: AdjustmentRow[]): FinancialSummary {
  const base = summarise(money, adjustments)
  const subscriptionCovered = round2(money.subscriptionCoveredAmount ?? 0)
  // Discount recorded at order time, plus everything given afterwards.
  const discount = round2((money.discount ?? 0) + base.compensation)
  return {
    invoiceTotal: base.invoiceTotal,
    subscriptionCovered,
    discount,
    netPayable: Math.max(0, round2(base.invoiceTotal - subscriptionCovered - discount)),
    paid: base.paid,
    refunded: base.refunded,
    refundDue: base.refundDue,
    balance: base.balance,
  }
}

/** Filter buckets on the Payments & Ledger list. */
export type LedgerFilter = "ALL" | "PENDING" | "PARTIAL" | "PAID" | "DISCOUNTED" | "REFUNDED"

export function matchesLedgerFilter(f: LedgerFilter, row: { paid: number; balance: number; discount: number; refunded: number; refundDue: number }): boolean {
  switch (f) {
    case "PENDING": return row.balance > 0 && row.paid <= 0
    case "PARTIAL": return row.balance > 0 && row.paid > 0
    case "PAID": return row.balance <= 0
    case "DISCOUNTED": return row.discount > 0
    case "REFUNDED": return row.refunded > 0 || row.refundDue > 0
    default: return true
  }
}

// ── Plain-language guidance on the discount form ────────────────────────────
// The form used to say "Up to ₹32.00 may still be given on this order." That
// number was maxCompensation() — correct, and meaningless to someone at a
// counter, because it silently mixes what is still owed with what could be
// refunded. A Store Manager needs to know two things: what has already
// happened, and what a discount will DO next.

export interface DiscountHint {
  /** What the money looks like right now. */
  status: string
  /** What adding a discount will cause. */
  effect: string
  /** Only when money has actually been taken and could come back. */
  refundLimit: string | null
}

const money = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function discountHint(m: OrderMoney, adjustments: AdjustmentRow[]): DiscountHint {
  const paid = round2(m.amountPaid)
  const payable = round2(m.balanceDue)
  const alreadyRefundable = round2(adjustments.reduce((s, a) => s + (a.refundable || 0), 0))
  // What could still come back: money taken, less what earlier discounts already
  // claimed against it.
  const refundable = Math.max(0, round2(paid - alreadyRefundable))

  if (paid > 0 && payable <= 0) {
    return {
      status: `Already paid: ${money(paid)}`,
      effect: "A discount now will create a refund due to the customer.",
      refundLimit: refundable > 0 ? `Maximum refund available: ${money(refundable)}` : null,
    }
  }

  if (paid > 0) {
    return {
      status: `Paid ${money(paid)} · ${money(payable)} still to pay`,
      effect: "A discount reduces what is still to pay first, then creates a refund.",
      refundLimit: refundable > 0 ? `Maximum refund available: ${money(refundable)}` : null,
    }
  }

  return {
    status: `Amount payable: ${money(payable)}`,
    effect: "A discount will reduce what the customer pays.",
    refundLimit: null,
  }
}
