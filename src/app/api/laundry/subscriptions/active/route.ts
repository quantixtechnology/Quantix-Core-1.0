// GET /api/laundry/subscriptions/active?businessId=&customerId=
// Automatic subscription DETECTION for New Order + Customer view (Parts 1/8).
// Returns the customer's ACTIVE / GRACE subscriptions with remaining KG/Piece,
// expiry, renewal and the eligible service names. Nothing is consumed.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const sp = new URL(request.url).searchParams
    const businessId = sp.get("businessId"); const customerId = sp.get("customerId")
    if (!businessId || !customerId) return NextResponse.json({ error: "businessId and customerId are required" }, { status: 400 })
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ success: true, data: [] })
    const platformId = biz.platformBusinessId || businessId

    const subs = await prisma.customerSubscription.findMany({
      where: { businessId: platformId, customerId, status: { in: ["ACTIVE", "GRACE"] } },
      orderBy: { createdAt: "asc" },
      include: { plan: { select: { name: true, autoRenew: true, coverageRules: { select: { serviceId: true, garmentId: true, allowanceMode: true } } } } },
    })
    const serviceIds = [...new Set(subs.flatMap((s) => s.plan.coverageRules.map((r) => r.serviceId)))]
    const services = serviceIds.length ? await prisma.laundryService.findMany({ where: { id: { in: serviceIds } }, select: { id: true, name: true } }) : []
    const svcName = new Map(services.map((s) => [s.id, s.name]))

    const data = subs.map((s) => ({
      id: s.id, planName: s.plan.name, status: s.status, autoRenew: s.plan.autoRenew,
      remainingKg: s.remainingKg, allowanceKg: s.allowanceKg, remainingPieces: s.remainingPieces, allowancePieces: s.allowancePieces,
      cycleStart: s.currentPeriodStart, expiry: s.currentPeriodEnd, graceEndsAt: s.graceEndsAt, renewalDate: s.nextBillingDate,
      eligibleServices: [...new Set(s.plan.coverageRules.map((r) => svcName.get(r.serviceId)).filter(Boolean))],
      coverageRules: s.plan.coverageRules,
    }))
    return NextResponse.json({ success: true, data })
  } catch (e) {
    console.error("[laundry-subscriptions-active] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
