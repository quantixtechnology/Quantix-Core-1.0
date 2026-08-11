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
