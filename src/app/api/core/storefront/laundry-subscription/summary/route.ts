// POST /api/core/storefront/laundry-subscription/summary
//
// The customer's subscription financial picture for "My Account": the ACTIVE
// plan (allowance/orders/cycle) if any, PLUS any pending purchase due that must
// keep following the customer until paid. Never consumes allowance.
//
// Body: { businessId, phone }  (guest identity, matching the checkout model).
// SECURITY NOTE: in a hardened deployment gate this behind the storefront OTP/
// auth so a due is not exposed for an arbitrary phone number.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { customerSubscriptionSummary } from "@/lib/laundry-subscription-purchase"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const { businessId, phone, customerId } = await request.json() as { businessId?: string; phone?: string; customerId?: string }
    if (!businessId) return NextResponse.json({ success: false, error: "businessId is required" }, { status: 400 })
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ success: false, error: "Laundry business not found" }, { status: 404 })
    const platformId = biz.platformBusinessId || businessId

    // Prefer the authenticated customer (Bearer token) — reliable for email-OTP
    // customers who have no phone. Fall back to an explicit customerId, then phone.
    let customer: { id: string } | null = null
    const token = request.headers.get("authorization")?.replace("Bearer ", "").trim()
    if (token) {
      const rt = await prisma.refreshToken.findFirst({ where: { token, expiresAt: { gte: new Date() } }, select: { userId: true } })
      if (rt?.userId) customer = await prisma.customer.findFirst({ where: { userId: rt.userId, businessId: platformId }, select: { id: true } })
    }
    if (!customer && customerId) customer = await prisma.customer.findFirst({ where: { id: customerId, businessId: platformId }, select: { id: true } })
    if (!customer && phone) customer = await prisma.customer.findFirst({ where: { businessId: platformId, phone }, select: { id: true } })
    if (!customer) return NextResponse.json({ success: true, data: { active: null, pending: null } })
    return NextResponse.json({ success: true, data: await customerSubscriptionSummary(platformId, customer.id) })
  } catch (e) {
    console.error("[laundry-subscription/summary] POST", e)
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 })
  }
}
