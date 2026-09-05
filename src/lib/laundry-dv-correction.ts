// ============================================================================
// DEAL VALUE CORRECTION — an authorised exception, Payments & Ledger only.
//
// Sometimes an order's Deal Value is simply wrong: it was priced before a
// subscription was known about, or a rate was mis-set, or a figure was agreed
// with the customer that the engine had no way to reach. This lets a small set
// of roles say what the number should be, and records who said it and why.
//
// It is NOT a discount. A discount says "the price was ₹900 and we are giving
// ₹459 back"; this says "the price was never ₹900, it is ₹441". So no
// LaundryOrderAdjustment is written, nothing lands in the discount column, and
// the invoice shows one figure rather than a total with something struck off.
// It is also not a payment or a refund: no money moves, and amountPaid is not
// touched.
//
// It changes ONE column — LaundryOrder.grandTotal, which is the Deal Value the
// whole financial stack already reads (financialSummary() takes invoiceTotal
// straight from it) — and then re-derives balanceDue with the SAME arithmetic
// every other payment path uses: max(0, grandTotal − amountPaid). The pricing
// engine, the subscription engine and the processing workflow are not involved
// and are not called.
//
// The audit is LaundryOrderEvent, the order's existing append-only log. Nothing
// is ever updated or deleted there, so a second correction adds a second row
// and the first remains readable forever. No schema change.
// ============================================================================
import { prisma } from "@/lib/prisma"

const r2 = (n: number) => Math.round(n * 100) / 100

/** The action name the audit log carries. Also how history is read back. */
export const DV_CORRECTION_ACTION = "DV_CORRECTION"

/**
 * Who may correct a Deal Value.
 *
 * Deliberately NOT a screen permission: this is a financial override, and the
 * three roles trusted with it are named. Anyone else — Store Manager, Cashier,
 * Staff, Viewer — is refused even though they can open the Payments screen and
 * take money on it.
 */
export function canCorrectDealValue(input: { platformRole?: string | null; isOwner?: boolean; roleCode?: string | null }): boolean {
  if (input.platformRole === "QUANTIX_SUPER_ADMIN") return true   // Quantix Super Admin
  if (input.isOwner) return true                                   // the business owner
  return (input.roleCode || "").trim().toUpperCase() === "ACCOUNTANT"
}

/** The label stored against the correction, so history reads without a join. */
export function roleLabelFor(input: { platformRole?: string | null; isOwner?: boolean; roleCode?: string | null }): string {
  if (input.platformRole === "QUANTIX_SUPER_ADMIN") return "Quantix Super Admin"
  if (input.isOwner) return "Owner"
  return "Accountant"
}

export interface DvValidation { ok: boolean; error?: string; value?: number; comment?: string }

/**
 * What a correction must satisfy before anything is written. Pure, so the
 * dialog and the endpoint can hold each other to the same rules.
 */
export function validateDvCorrection(newDv: unknown, comment: unknown): DvValidation {
  // Absent is not zero. Number(null) is 0 and Number("") is 0, so a missing
  // field would otherwise be accepted as a correction to ₹0 — the one mistake
  // this dialog must never make silently.
  if (newDv === null || newDv === undefined || (typeof newDv === "string" && newDv.trim() === "")) {
    return { ok: false, error: "Enter a valid Deal Value." }
  }
  const n = typeof newDv === "number" ? newDv : Number(newDv)
  if (!Number.isFinite(n)) return { ok: false, error: "Enter a valid Deal Value." }
  if (n < 0) return { ok: false, error: "Deal Value cannot be negative." }
  // A correction without a reason is unauditable, which defeats the point.
  const c = typeof comment === "string" ? comment.trim() : ""
  if (!c) return { ok: false, error: "A comment is required for a Deal Value correction." }
  return { ok: true, value: r2(n), comment: c }
}

export interface DvCorrectionRow {
  at: string
  user: string
  role: string
  previousDv: number
  newDv: number
  comment: string
}

/** Parse one audit row back. Tolerant: a malformed note never breaks history. */
function parseRow(e: { createdAt: Date; actorName: string | null; note: string | null }): DvCorrectionRow | null {
  try {
    const d = JSON.parse(e.note || "{}") as Record<string, unknown>
    return {
      at: e.createdAt.toISOString(),
      user: e.actorName || String(d.user || "—"),
      role: String(d.role || "—"),
      previousDv: Number(d.previousDv ?? 0),
      newDv: Number(d.newDv ?? 0),
      comment: String(d.comment || ""),
    }
  } catch { return null }
}

/** Every correction ever made to this order, newest first. Never truncated. */
export async function dvCorrectionHistory(orderId: string): Promise<DvCorrectionRow[]> {
  const rows = await prisma.laundryOrderEvent.findMany({
    where: { orderId, action: DV_CORRECTION_ACTION },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, actorName: true, note: true },
  })
  return rows.map(parseRow).filter((r): r is DvCorrectionRow => r !== null)
}

export interface DvCorrectionResult {
  ok: boolean
  error?: string
  previousDv?: number
  newDv?: number
  balanceDue?: number
  paymentStatus?: string
}

/**
 * Apply the correction. The order row and the audit row are written together,
 * so a failure leaves the Deal Value and the history both untouched — there is
 * never a corrected order with no record of who corrected it.
 */
export async function correctDealValue(orderId: string, input: {
  newDv: unknown
  comment: unknown
  actorId?: string | null
  actorName?: string | null
  role: string
}): Promise<DvCorrectionResult> {
  const v = validateDvCorrection(input.newDv, input.comment)
  if (!v.ok) return { ok: false, error: v.error }

  const order = await prisma.laundryOrder.findUnique({
    where: { id: orderId },
    select: { id: true, businessId: true, orderNumber: true, grandTotal: true, amountPaid: true, status: true },
  })
  if (!order) return { ok: false, error: "Order not found" }

  const previousDv = r2(order.grandTotal)
  const newDv = v.value!
  // The same arithmetic every payment path uses. Nothing else is re-derived:
  // amountPaid is the customer's money and is not the correction's business.
  const balanceDue = r2(Math.max(0, newDv - order.amountPaid))
  const paymentStatus = balanceDue <= 0
    ? (order.amountPaid > 0 ? "PAID" : "SUBSCRIPTION")
    : (order.amountPaid > 0 ? "PARTIAL" : "UNPAID")

  await prisma.$transaction(async (tx) => {
    await tx.laundryOrder.update({ where: { id: orderId }, data: { grandTotal: newDv, balanceDue, paymentStatus } })
    await tx.laundryOrderEvent.create({
      data: {
        orderId, businessId: order.businessId,
        // The order does not move; only its value changes.
        fromStatus: order.status, toStatus: order.status,
        action: DV_CORRECTION_ACTION,
        actorId: input.actorId ?? null,
        actorName: input.actorName ?? null,
        note: JSON.stringify({
          orderNumber: order.orderNumber,
          previousDv, newDv,
          comment: v.comment,
          user: input.actorName ?? null,
          role: input.role,
        }),
      },
    })
  })

  return { ok: true, previousDv, newDv, balanceDue, paymentStatus }
}
