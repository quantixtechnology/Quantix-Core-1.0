// POST /api/core/storefront/laundry-subscription/status
//
// The customer's subscription balance. ONE endpoint, used by BOTH:
//   - the "Use my subscription allowance" checkbox in pickup scheduling
//   - the storefront Active → View Plan usage popup
// so the two can never disagree. The arithmetic lives in
// src/lib/laundry-subscription-balance.ts and is summed from the existing
// SubscriptionUsage rows. This endpoint never consumes allowance.
//
// SECURITY NOTE: the phone fallback is the storefront's existing guest identity.
// In a hardened deployment it should be gated behind the storefront OTP/auth so
// a subscription summary is not exposed for an arbitrary phone number. The token
// path added below is already properly authenticated.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { subscriptionBalance } from "@/lib/laundry-subscription-balance"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const { businessId, phone, customerId } = await request.json() as { businessId?: string; phone?: string; customerId?: string }
    // A Bearer token identifies the customer on its own, so phone/customerId are
    // only needed for the guest path.
    const authToken = request.headers.get("authorization")?.replace("Bearer ", "").trim()
    if (!businessId || (!phone && !customerId && !authToken)) return NextResponse.json({ success: false, error: "businessId and a customer identity are required" }, { status: 400 })
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ success: false, error: "Laundry business not found" }, { status: 404 })
    const platformId = biz.platformBusinessId || businessId

    // Identity resolution mirrors /summary: the Bearer token first (reliable for
    // email-OTP customers, who have no phone), then an explicit id, then phone.
    // Adding the token path is what lets the logged-in customer read their own
    // balance; the phone fallback keeps the existing checkout behaviour.
    let customer: { id: string } | null = null
    if (authToken) {
      const rt = await prisma.refreshToken.findFirst({ where: { token: authToken, expiresAt: { gte: new Date() } }, select: { userId: true } })
      if (rt?.userId) customer = await prisma.customer.findFirst({ where: { userId: rt.userId, businessId: platformId }, select: { id: true } })
    }
    if (!customer && customerId) customer = await prisma.customer.findFirst({ where: { id: customerId, businessId: platformId }, select: { id: true } })
    if (!customer && phone) customer = await prisma.customer.findFirst({ where: { businessId: platformId, phone }, select: { id: true } })
    if (!customer) return NextResponse.json({ success: true, data: { active: false } })

    const sub = await prisma.customerSubscription.findFirst({
      where: { businessId: platformId, customerId: customer.id, status: "ACTIVE" },
      include: {
        plan: { select: { name: true, price: true, billingCycle: true, totalCredits: true, maxOrdersPerCycle: true } },
        // orderId + createdAt come from the SAME rows the balance is summed
        // from, so "last updated" cannot drift from the figures above.
        usages: { select: { creditsUsed: true, orderId: true, createdAt: true }, orderBy: { createdAt: "desc" } },
      },
    })
    if (!sub) return NextResponse.json({ success: true, data: { active: false } })

    const balance = subscriptionBalance({ totalCredits: sub.totalCredits, planTotalCredits: sub.plan.totalCredits, usages: sub.usages })

    // When the balance last moved, and for which order. Store Audit is where a
    // service becomes officially counted, so the order's EXISTING auditedAt is
    // preferred over the usage row's own timestamp — no new timestamp is
    // recorded anywhere for this.
    const lastUsage = sub.usages[0] ?? null
    let lastService: { orderId: string; orderNumber: string; at: Date; audited: boolean } | null = null
    if (lastUsage?.orderId) {
      const order = await prisma.laundryOrder.findUnique({
        where: { id: lastUsage.orderId },
        select: { id: true, orderNumber: true, auditedAt: true },
      })
      if (order) {
        lastService = {
          orderId: order.id, orderNumber: order.orderNumber,
          at: order.auditedAt ?? lastUsage.createdAt,
          audited: !!order.auditedAt,
        }
      }
    }

    return NextResponse.json({ success: true, data: {
      active: true, subscriptionId: sub.id, planName: sub.plan.name,
      planPrice: sub.plan.price, billingCycle: sub.plan.billingCycle,
      allowance: balance.allowance, used: balance.used, remaining: balance.remaining,
      fullyUsed: balance.fullyUsed, percentUsed: balance.percentUsed,
      ordersUsed: balance.ordersUsed, maxOrders: sub.plan.maxOrdersPerCycle,
      cycleStart: sub.currentPeriodStart, cycleEnd: sub.currentPeriodEnd,
      lastUpdatedAt: lastService?.at ?? lastUsage?.createdAt ?? null,
      lastUpdatedAfterAudit: !!lastService?.audited,
      lastService,
    } })
  } catch (e) {
    console.error("[laundry-subscription/status] POST", e)
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 })
  }
}
