// POST /api/core/storefront/laundry-subscription/preview
//
// Given a customer's laundry subscription and the garments they want to submit,
// returns the cloth-allowance breakdown for THIS order: how many garments the
// plan covers, how many spill over as chargeable extra, the remaining allowance
// and orders, and the extra-garment charge. Extras are priced through the SAME
// Billing Resolver as any normal order (never a flat extra-cloth price).
//
// Body:
//   { businessId, items: [{ serviceId, garmentId, quantity }],
//     subscriptionId? }                     // resolve state from a real sub, OR
//   { businessId, items, state: { totalCredits, usedCredits, ordersUsed, maxOrdersPerCycle } }
//
// Usage is derived from SubscriptionUsage rows (auditable) when a real
// subscription is supplied, not just the mutable counter.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { resolveOrderBilling } from "@/lib/laundry-billing-server"
import { computeSubscriptionAllocation, type SubscriptionState, type SubmittedItem } from "@/lib/laundry-subscription"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { businessId, items, subscriptionId, state } = body as {
      businessId?: string; items?: SubmittedItem[]; subscriptionId?: string; state?: SubscriptionState
    }
    if (!businessId) return NextResponse.json({ success: false, error: "businessId is required" }, { status: 400 })
    if (!Array.isArray(items)) return NextResponse.json({ success: false, error: "items must be an array" }, { status: 400 })

    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ success: false, error: "Laundry business not found" }, { status: 404 })

    // Resolve the subscription state (allowance/used/orders/limit).
    let subState: SubscriptionState
    let planName = "Subscription"
    if (state) {
      subState = state
    } else if (subscriptionId) {
      const sub = await prisma.customerSubscription.findUnique({
        where: { id: subscriptionId },
        include: { plan: { select: { name: true, totalCredits: true, maxOrdersPerCycle: true } }, usages: { select: { creditsUsed: true } } },
      })
      if (!sub) return NextResponse.json({ success: false, error: "Subscription not found" }, { status: 404 })
      planName = sub.plan.name
      // Derive usage from the auditable usage rows (source of truth).
      const usedCredits = sub.usages.reduce((s, u) => s + (u.creditsUsed || 0), 0)
      const ordersUsed = sub.usages.length
      subState = {
        totalCredits: sub.totalCredits || sub.plan.totalCredits,
        usedCredits,
        ordersUsed,
        maxOrdersPerCycle: sub.plan.maxOrdersPerCycle ?? null,
      }
    } else {
      return NextResponse.json({ success: false, error: "Provide subscriptionId or state" }, { status: 400 })
    }

    const allocation = computeSubscriptionAllocation(subState, items)

    // Price the extra garments through the normal Billing Resolver.
    let extraCharge = { subtotal: 0, gstTotal: 0, grandTotal: 0, lines: [] as unknown[] }
    if (allocation.extraLines.length > 0) {
      const { quote } = await resolveOrderBilling(
        biz.id,
        { storeId: null, customerType: null },
        allocation.extraLines.map((l) => ({ serviceId: l.serviceId, garmentId: l.garmentId, quantity: l.quantity })),
      )
      extraCharge = { subtotal: quote.subtotal, gstTotal: quote.gstTotal, grandTotal: quote.grandTotal, lines: quote.lines }
    }

    return NextResponse.json({
      success: true,
      data: {
        planName,
        cycleAllowance: subState.totalCredits,
        previouslyUsed: subState.usedCredits,
        maxOrdersPerCycle: subState.maxOrdersPerCycle,
        ...allocation,
        extraCharge,
      },
    })
  } catch (e) {
    console.error("[laundry-subscription/preview] POST", e)
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : "Failed" }, { status: 500 })
  }
}
