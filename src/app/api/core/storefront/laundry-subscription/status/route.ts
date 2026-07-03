// POST /api/core/storefront/laundry-subscription/status
//
// Entitlement check for the storefront "Use my subscription allowance" checkbox.
// Given a customer (by phone within the tenant), returns whether they have an
// ACTIVE laundry subscription and its current-cycle usage summary (allowance,
// used, remaining, orders used, max orders). Usage is derived from auditable
// SubscriptionUsage rows — this endpoint never consumes allowance.
//
// SECURITY NOTE: this reuses the storefront's phone-based guest identity. In a
// hardened deployment this should be gated behind the existing storefront OTP/
// auth so a subscription summary is not exposed for an arbitrary phone number.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const { businessId, phone, customerId } = await request.json() as { businessId?: string; phone?: string; customerId?: string }
    if (!businessId || (!phone && !customerId)) return NextResponse.json({ success: false, error: "businessId and phone are required" }, { status: 400 })
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ success: false, error: "Laundry business not found" }, { status: 404 })
    const platformId = biz.platformBusinessId || businessId

    const customer = customerId
      ? await prisma.customer.findFirst({ where: { id: customerId, businessId: platformId }, select: { id: true } })
      : await prisma.customer.findFirst({ where: { businessId: platformId, phone }, select: { id: true } })
    if (!customer) return NextResponse.json({ success: true, data: { active: false } })

    const sub = await prisma.customerSubscription.findFirst({
      where: { businessId: platformId, customerId: customer.id, status: "ACTIVE" },
      include: { plan: { select: { name: true, totalCredits: true, maxOrdersPerCycle: true } }, usages: { select: { creditsUsed: true } } },
    })
    if (!sub) return NextResponse.json({ success: true, data: { active: false } })

    const used = sub.usages.reduce((s, u) => s + (u.creditsUsed || 0), 0)
    const allowance = sub.totalCredits || sub.plan.totalCredits
    return NextResponse.json({ success: true, data: {
      active: true, subscriptionId: sub.id, planName: sub.plan.name,
      allowance, used, remaining: Math.max(0, allowance - used),
      ordersUsed: sub.usages.length, maxOrders: sub.plan.maxOrdersPerCycle,
    } })
  } catch (e) {
    console.error("[laundry-subscription/status] POST", e)
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 })
  }
}
