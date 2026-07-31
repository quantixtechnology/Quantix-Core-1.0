// Customer Rating & Feedback engine (shared). A delivered order can be rated
// ONCE by the customer who placed it — rating 1–5 mandatory, comment optional.
// The record is owned by the order (@@unique(orderId)) so a second submission
// is impossible at the DB level. Business-owner only: never exposed publicly.
// No auth here; callers gate (customer session / ownership already resolved).
import { prisma } from "@/lib/prisma"

export type FeedbackSubmitResult =
  | { ok: true; feedback: { rating: number; comment: string | null; submittedAt: Date } }
  | { ok: false; status: number; error: string }

export interface FeedbackRow {
  rating: number
  comment: string | null
  submittedAt: Date
}

export function sanitizeRating(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : v
  return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 5 ? n : null
}

// Submit feedback for an order. Ownership is enforced by looking the order up
// through the authenticated customer's id — only the customer who placed the
// order can ever reach it. Enforces: only DELIVERED orders, one submission.
export async function submitOrderFeedback(opts: {
  orderId: string
  customerId: string
  rating: number
  comment?: string
}): Promise<FeedbackSubmitResult> {
  const rating = sanitizeRating(opts.rating)
  if (rating === null) return { ok: false, status: 400, error: "Rating must be between 1 and 5 stars." }

  const order = await prisma.laundryOrder.findFirst({
    where: { id: opts.orderId, customerId: opts.customerId },
    select: { id: true, businessId: true, status: true },
  })
  if (!order) return { ok: false, status: 404, error: "Order not found" }
  if (order.status !== "DELIVERED") {
    return { ok: false, status: 409, error: order.status === "CANCELLED" ? "This order was cancelled." : "Feedback can only be submitted after the order is delivered." }
  }

  const existing = await prisma.laundryOrderFeedback.findUnique({ where: { orderId: order.id }, select: { id: true } })
  if (existing) return { ok: false, status: 409, error: "Feedback has already been submitted for this order." }

  const comment = typeof opts.comment === "string" ? opts.comment.trim() : ""
  const created = await prisma.laundryOrderFeedback.create({
    data: {
      businessId: order.businessId,
      orderId: order.id,
      customerId: opts.customerId,
      rating,
      comment: comment || null,
    },
  })
  return { ok: true, feedback: { rating: created.rating, comment: created.comment, submittedAt: created.submittedAt } }
}

// Read the feedback for an order (null when none) — shared by admin + customer
// detail responses so both show the exact same submitted record.
export async function getOrderFeedback(orderId: string): Promise<FeedbackRow | null> {
  const f = await prisma.laundryOrderFeedback.findUnique({ where: { orderId }, select: { rating: true, comment: true, submittedAt: true } })
  return f ? { rating: f.rating, comment: f.comment, submittedAt: f.submittedAt } : null
}

// Aggregate rating summaries for a business (optional store scope) — the
// dashboard cards. All counts computed from submitted feedback records only.
export async function getFeedbackSummary(lbId: string, storeId?: string | null) {
  // Feedback is joined through the order so store scoping applies cleanly.
  const orderWhere: Record<string, unknown> = { businessId: lbId, feedback: { isNot: null } }
  if (storeId) orderWhere.storeId = storeId
  const orders = await prisma.laundryOrder.findMany({
    where: orderWhere as never,
    select: { feedback: { select: { rating: true } } },
  })
  const reviews = orders.filter((o) => o.feedback).map((o) => o.feedback!.rating)
  const counts: Record<string, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (const r of reviews) counts[r] = (counts[r] || 0) + 1
  const total = reviews.length
  const average = total > 0 ? Math.round((reviews.reduce((a, b) => a + b, 0) / total) * 100) / 100 : 0
  return { average, total, byRating: counts }
}
