// POST /api/core/storefront/laundry-orders/[orderId]/feedback
// Submit customer rating & feedback for a DELIVERED laundry order. Tenant +
// ownership scoped (order must belong to the signed-in customer). Rating 1–5
// mandatory, comment optional, one submission per order.
import { NextResponse } from "next/server"
import { withMiddleware } from "@/lib/middleware"
import { db } from "@/lib/db"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { normalizePhone } from "@/lib/customer-identity"
import { submitOrderFeedback, sanitizeRating } from "@/lib/laundry-feedback"

async function resolveCustomerId(userId: string, businessId: string): Promise<string[]> {
  const userRec = await db.user.findUnique({ where: { id: userId }, select: { phone: true } })
  const norm = userRec?.phone ? normalizePhone(userRec.phone) : null
  const rows = await db.customer.findMany({
    where: { businessId, OR: [{ userId }, ...(norm ? [{ phone: norm }, { phone: userRec!.phone! }] : [])] },
    select: { id: true },
  })
  return rows.map((r) => r.id)
}

export const POST = withMiddleware({ requireAuth: true, requiredRoles: ["CUSTOMER"] })(async (req, context) => {
  try {
    const params = await context?.params
    const orderId = params?.orderId as string | undefined
    if (!orderId) return NextResponse.json({ success: false, error: "orderId required" }, { status: 400 })
    const user = req.user!
    const platformId = user.businessId!
    const biz = await resolveLaundryBusiness(platformId)
    if (!biz) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 })

    const customerIds = await resolveCustomerId(user.id, platformId)
    // Ownership + tenant scoping up front: we need the exact customerId to stamp
    // on the feedback record.
    const order = await db.laundryOrder.findFirst({
      where: { id: orderId, businessId: biz.id, customerId: { in: customerIds } },
      select: { customerId: true },
    })
    if (!order) return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 })

    const b = await req.json().catch(() => ({}))
    const rating = sanitizeRating(b.rating)
    if (rating === null) return NextResponse.json({ success: false, error: "Rating must be between 1 and 5 stars." }, { status: 400 })

    const r = await submitOrderFeedback({
      orderId,
      customerId: order.customerId!,
      rating,
      comment: typeof b.comment === "string" ? b.comment : "",
    })
    if (!r.ok) return NextResponse.json({ success: false, error: r.error }, { status: r.status })
    return NextResponse.json({ success: true, data: r.feedback }, { status: 201 })
  } catch (e) {
    console.error("[storefront-laundry-order-feedback] POST", e)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
})
