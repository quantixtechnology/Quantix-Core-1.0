// POST /api/core/storefront/laundry-subscription/purchase/confirm
//
// Called AFTER the customer completes payment (Razorpay). Verifies the payment
// (same HMAC check the platform's razorpay/verify uses) and only then activates
// the CustomerSubscription. Authenticated customer only. Idempotent.
import { NextResponse } from "next/server"
import { withMiddleware } from "@/lib/middleware"
import { db } from "@/lib/db"
import { confirmSubscriptionPurchase, markPurchaseFailed } from "@/lib/laundry-subscription-purchase"

async function resolveCustomer(userId: string, businessId: string, phone?: string | null) {
  const byUser = await db.customer.findFirst({ where: { userId, businessId } })
  if (byUser) return byUser
  if (phone) return db.customer.findFirst({ where: { businessId, phone, userId: null } })
  return null
}

export const POST = withMiddleware({ requireAuth: true, requiredRoles: ["CUSTOMER"] })(async (req) => {
  try {
    const user = req.user!
    const businessId = user.businessId!
    const body = await req.json().catch(() => ({}))
    if (!body.purchaseId) return NextResponse.json({ success: false, error: "purchaseId is required" }, { status: 400 })

    const userRecord = await db.user.findUnique({ where: { id: user.id }, select: { phone: true } })
    const customer = await resolveCustomer(user.id, businessId, userRecord?.phone)
    if (!customer) return NextResponse.json({ success: false, error: "Customer account not found" }, { status: 404 })

    if (body.failed) {
      await markPurchaseFailed(body.purchaseId, customer.id)
      return NextResponse.json({ success: false, paymentFailed: true, error: "Payment failed — subscription not activated." })
    }

    const res = await confirmSubscriptionPurchase({
      purchaseId: body.purchaseId, customerId: customer.id,
      payment: { gateway: body.gateway, orderId: body.razorpay_order_id, paymentId: body.razorpay_payment_id, signature: body.razorpay_signature },
    })
    if (!res.ok) return NextResponse.json({ success: false, pending: res.pending, error: res.error }, { status: res.pending ? 402 : 400 })

    return NextResponse.json({ success: true, data: {
      subscriptionId: res.subscriptionId, alreadyActivated: res.alreadyActivated,
      cycle: res.cycle, plan: res.plan ? { name: res.plan.name, totalCredits: res.plan.totalCredits, maxOrdersPerCycle: res.plan.maxOrdersPerCycle } : undefined,
    } }, { status: 200 })
  } catch (e) {
    console.error("[laundry-sub-confirm] POST", e)
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : "Failed" }, { status: 500 })
  }
})
