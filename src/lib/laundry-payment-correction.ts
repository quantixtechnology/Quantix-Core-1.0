// ============================================================================
// ERRONEOUS PAYMENT CORRECTION — Payments & Ledger only.
//
// Staff sometimes mark an order paid when no money was ever handed over. That
// entry is not a payment the customer later got back; it is a payment that
// never happened. So this is NOT a refund and NOT a reversal: no money moves,
// nothing is paid back, and no second row is written to stand against the
// first. Recording a refund here would invent a movement of the customer's
// money that never took place, which is exactly the lie being corrected.
//
// The row is kept. Its amount, method, author, note and time stay precisely as
// they were entered, so the mistake and its correction both remain readable
// forever. What changes is that it stops being money:
//
//   • status becomes CORRECTED. This is the whole exclusion mechanism, and it
//     needs no new query anywhere: the money queries already ask for SUCCESS
//     (the Payments & Ledger TODAY collections list is written that way), so a
//     corrected row drops out of them on its own, unchanged.
//   • correctedAt / correctedBy / correctedByName / correctionReason record who
//     corrected it and why — the same shape as a voided adjustment.
//
// The order's cached money is then re-derived with the SAME arithmetic every
// payment path uses: amountPaid loses exactly the corrected amount, and
// balanceDue is max(0, grandTotal − amountPaid). grandTotal is not touched (the
// Deal Value is a separate decision, with its own correction), no adjustment is
// written, the subscription engine is not called, and the order does not move —
// LaundryOrder.status is never written here.
//
// Audit is LaundryOrderEvent, the order's existing append-only log, so a
// correction can be read back beside every other thing that happened to the
// order without a join.
// ============================================================================
import { prisma } from "@/lib/prisma"
import { roleLabelFor } from "@/lib/laundry-dv-correction"

const r2 = (n: number) => Math.round(n * 100) / 100

/** The status an erroneously entered payment carries once corrected. */
export const PAYMENT_CORRECTED_STATUS = "CORRECTED"

/** The action name the audit log carries. Also how history is read back. */
export const PAYMENT_CORRECTION_ACTION = "PAYMENT_CORRECTION"

/**
 * Where-fragment for reads that report money the customer actually paid.
 *
 * The Payments & Ledger TODAY list already narrows to SUCCESS and so needs
 * nothing; this is for the lists that never filtered at all, where a corrected
 * entry would otherwise still read as ₹900 received.
 */
export const LIVE_PAYMENT_WHERE = { status: { not: PAYMENT_CORRECTED_STATUS } } as const

/** A corrected payment stays on the record and stops being money. */
export const isCorrectedPayment = (p: { status?: string | null; correctedAt?: Date | string | null }): boolean =>
  p.correctedAt != null || (p.status || "").toUpperCase() === PAYMENT_CORRECTED_STATUS

/**
 * Methods that are not a staff-entered receipt and so are not correctable here.
 *
 * SUBSCRIPTION is allowance coverage written by the subscription engine — it is
 * that engine's row to create and remove, and touching it here would change what
 * a customer's plan has covered. REFUND is money that genuinely left the till;
 * undoing one is a different act with different consequences.
 */
export const UNCORRECTABLE_METHODS = ["SUBSCRIPTION", "REFUND"] as const

export interface CorrectionValidation { ok: boolean; error?: string; reason?: string }

/**
 * What a correction must satisfy before anything is written. Pure, so the
 * dialog and the endpoint can hold each other to the same rules.
 */
export function validatePaymentCorrection(reason: unknown): CorrectionValidation {
  const c = typeof reason === "string" ? reason.trim() : ""
  // Without a reason the correction is unauditable, which defeats the point:
  // the record would show money removed and nothing about why.
  if (!c) return { ok: false, error: "A reason is required to correct a payment." }
  return { ok: true, reason: c }
}

export interface PaymentCorrectionResult {
  ok: boolean
  error?: string
  /** Set when the payment was already corrected, so the caller can answer 409. */
  alreadyCorrected?: boolean
  amount?: number
  amountPaid?: number
  balanceDue?: number
  paymentStatus?: string
}

/**
 * Apply the correction. The payment row, the order's cached money and the audit
 * row are written together, so there is never a corrected payment with no record
 * of who corrected it, and never a re-derived balance without the row that
 * explains it.
 */
export async function correctErroneousPayment(orderId: string, paymentId: string, input: {
  reason: unknown
  actorId?: string | null
  actorName?: string | null
  role: string
}): Promise<PaymentCorrectionResult> {
  const v = validatePaymentCorrection(input.reason)
  if (!v.ok) return { ok: false, error: v.error }

  const order = await prisma.laundryOrder.findUnique({
    where: { id: orderId },
    select: { id: true, businessId: true, orderNumber: true, grandTotal: true, amountPaid: true, status: true },
  })
  if (!order) return { ok: false, error: "Order not found" }

  // Scoped to the order: a payment id from another order is not found here,
  // rather than corrected against the wrong customer's money.
  const pay = await prisma.laundryPayment.findFirst({
    where: { id: paymentId, orderId },
    select: { id: true, amount: true, method: true, status: true, correctedAt: true },
  })
  if (!pay) return { ok: false, error: "Payment not found on this order" }

  if (isCorrectedPayment(pay)) return { ok: false, alreadyCorrected: true, error: "This payment has already been corrected." }
  if ((UNCORRECTABLE_METHODS as readonly string[]).includes((pay.method || "").toUpperCase())) {
    return {
      ok: false,
      error: pay.method.toUpperCase() === "SUBSCRIPTION"
        ? "Subscription coverage is not a staff-entered payment and cannot be corrected here."
        : "A refund cannot be corrected here.",
    }
  }

  const amount = r2(pay.amount || 0)
  // The entry was never money, so the order loses exactly it — no more, and
  // never below zero. grandTotal is deliberately not re-derived: what the order
  // is worth is a separate decision with its own correction.
  const amountPaid = r2(Math.max(0, (order.amountPaid || 0) - amount))
  const balanceDue = r2(Math.max(0, order.grandTotal - amountPaid))
  const paymentStatus = balanceDue <= 0
    ? (amountPaid > 0 ? "PAID" : "SUBSCRIPTION")
    : (amountPaid > 0 ? "PARTIAL" : "UNPAID")

  await prisma.$transaction(async (tx) => {
    await tx.laundryPayment.update({
      where: { id: paymentId },
      // Only the correction columns. amount, method, note, createdBy and
      // createdAt are the record of what was entered and stay as they are.
      data: {
        status: PAYMENT_CORRECTED_STATUS,
        correctedAt: new Date(),
        correctedBy: input.actorId ?? null,
        correctedByName: input.actorName ?? null,
        correctionReason: v.reason!,
      },
    })
    await tx.laundryOrder.update({ where: { id: orderId }, data: { amountPaid, balanceDue, paymentStatus } })
    await tx.laundryOrderEvent.create({
      data: {
        orderId, businessId: order.businessId,
        // The order does not move; only what it is recorded as having received.
        fromStatus: order.status, toStatus: order.status,
        action: PAYMENT_CORRECTION_ACTION,
        actorId: input.actorId ?? null,
        actorName: input.actorName ?? null,
        note: JSON.stringify({
          orderNumber: order.orderNumber,
          paymentId, amount, method: pay.method,
          previousAmountPaid: r2(order.amountPaid || 0),
          amountPaid, balanceDue,
          reason: v.reason,
          user: input.actorName ?? null,
          role: input.role,
        }),
      },
    })
  })

  return { ok: true, amount, amountPaid, balanceDue, paymentStatus }
}

export { roleLabelFor }
