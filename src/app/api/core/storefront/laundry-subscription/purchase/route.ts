// POST /api/core/storefront/laundry-subscription/purchase
//
// Start a subscription purchase for the AUTHENTICATED customer (existing
// storefront customer session — no name/phone mini-checkout). Creates a PENDING
// SubscriptionPurchase and returns whether an online gateway is available so the
// UI can continue to the existing payment step. It does NOT activate anything.
import { NextResponse } from "next/server"
import { withMiddleware } from "@/lib/middleware"
import { db } from "@/lib/db"
import { createSubscriptionPurchase } from "@/lib/laundry-subscription-purchase"

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
    if (!body.planId) return NextResponse.json({ success: false, error: "planId is required" }, { status: 400 })

    const userRecord = await db.user.findUnique({ where: { id: user.id }, select: { phone: true } })
    const customer = await resolveCustomer(user.id, businessId, userRecord?.phone)
    if (!customer) return NextResponse.json({ success: false, error: "Customer account not found" }, { status: 404 })

    const res = await createSubscriptionPurchase({ businessId, customerId: customer.id, planId: body.planId })
    if (!res.ok) return NextResponse.json({ success: false, error: res.error, alreadyActive: res.alreadyActive, subscriptionId: res.subscriptionId }, { status: 200 })

    return NextResponse.json({ success: true, data: {
      purchaseId: res.purchase.id, amount: res.purchase.amount, currency: res.purchase.currency,
      planName: res.plan.name, billingCycle: res.plan.billingCycle,
      onlineGateways: res.onlineGateways,
      // No online gateway configured for this tenant → payment cannot be taken
      // yet; the purchase stays PAYMENT_PENDING (honest — nothing is faked).
      paymentPending: res.onlineGateways.length === 0,
      customer: { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone },
    } }, { status: 201 })
  } catch (e) {
    console.error("[laundry-sub-purchase] POST", e)
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : "Failed" }, { status: 500 })
  }
})
