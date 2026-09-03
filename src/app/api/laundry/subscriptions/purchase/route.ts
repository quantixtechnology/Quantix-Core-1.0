// POST /api/laundry/subscriptions/purchase
//
// Staff sells a subscription to a walk-in customer at the counter. It raises the
// SAME pending SubscriptionPurchase the storefront raises, for a customer who is
// already on this tenant's books — nothing here prices, activates or grants
// anything.
//
// Once the purchase exists, the money is collected through the existing
// POST /api/laundry/subscriptions/collect, which applies it with
// applyPaymentToPurchase() and activates the membership + allowance the moment
// the purchase is fully paid. That is why this endpoint stops at creation: the
// counter already had a working collection path and did not need a second one.
//
// Body: { businessId, customerId, planId }
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { createSubscriptionPurchase } from "@/lib/laundry-subscription-purchase"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const { businessId, customerId, planId } = (await request.json().catch(() => ({}))) as {
      businessId?: string; customerId?: string; planId?: string
    }
    if (!businessId || !customerId || !planId) {
      return NextResponse.json({ success: false, error: "businessId, customerId and planId are required" }, { status: 400 })
    }
    // The same permission the counter already needs to take the money for one.
    const guard = await requireLaundryPermission(request, businessId, "store_ops.payment_collection.operate")
    if (!guard.ok) return guard.res

    const biz = await resolveLaundryBusiness(businessId)
    if (!biz?.platformBusinessId) return NextResponse.json({ success: false, error: "Laundry business not found" }, { status: 404 })
    const platformId = biz.platformBusinessId

    // Both sides of the sale must belong to THIS tenant. Subscriptions are keyed
    // on the platform business id, so the customer and the plan are checked
    // against it rather than against whatever id the caller passed.
    const customer = await prisma.customer.findFirst({ where: { id: customerId, businessId: platformId }, select: { id: true, name: true } })
    if (!customer) return NextResponse.json({ success: false, error: "Customer not found" }, { status: 404 })
    const plan = await prisma.subscriptionPlan.findFirst({
      where: { id: planId, businessId: platformId, serviceType: "LAUNDRY", isActive: true },
      select: { id: true, name: true, price: true, billingCycle: true },
    })
    if (!plan) return NextResponse.json({ success: false, error: "Plan not found or inactive" }, { status: 404 })

    // The one creation path, shared with the storefront. It owns the price, the
    // already-subscribed refusal and the reuse of an open purchase.
    const res = await createSubscriptionPurchase({ businessId: platformId, customerId: customer.id, planId: plan.id })
    if (!res.ok) {
      return NextResponse.json({ success: false, error: res.error, alreadyActive: res.alreadyActive ?? false, subscriptionId: res.subscriptionId ?? null }, { status: 409 })
    }

    return NextResponse.json({
      success: true,
      data: {
        purchaseId: res.purchase.id,
        customerName: customer.name,
        planName: plan.name,
        billingCycle: plan.billingCycle,
        amount: res.purchase.amount,
        amountPaid: res.purchase.amountPaid,
        outstandingDue: Math.round((res.purchase.amount - res.purchase.amountPaid) * 100) / 100,
        status: res.purchase.status,
        paymentStatus: res.purchase.paymentStatus,
      },
    }, { status: 201 })
  } catch (e) {
    console.error("[laundry-subscriptions/purchase] POST", e)
    return NextResponse.json({ success: false, error: "Could not start the subscription" }, { status: 500 })
  }
}
