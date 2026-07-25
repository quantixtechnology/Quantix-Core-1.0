// POST /api/core/storefront/laundry-subscription/cancel
//
// A logged-in customer cancels their OWN pending subscription request (the
// "Cancel Request" action). Only INITIATED / PAYMENT_PENDING purchases can be
// cancelled — an activated membership is never touched here. The customer is
// resolved from the auth Bearer token, so one customer can never cancel another's.
//
// Body: { businessId, purchaseId }  ·  Header: Authorization: Bearer <token>
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { cancelSubscriptionPurchase } from "@/lib/laundry-subscription-purchase"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const { businessId, purchaseId } = (await request.json().catch(() => ({}))) as { businessId?: string; purchaseId?: string }
    if (!businessId || !purchaseId) return NextResponse.json({ success: false, error: "businessId and purchaseId are required" }, { status: 400 })

    const token = request.headers.get("authorization")?.replace("Bearer ", "").trim()
    if (!token) return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 })
    const rt = await prisma.refreshToken.findFirst({ where: { token, expiresAt: { gte: new Date() } }, select: { userId: true } })
    if (!rt?.userId) return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 })

    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ success: false, error: "Laundry business not found" }, { status: 404 })
    const platformId = biz.platformBusinessId || businessId

    const customer = await prisma.customer.findFirst({ where: { userId: rt.userId, businessId: platformId }, select: { id: true } })
    if (!customer) return NextResponse.json({ success: false, error: "Customer not found" }, { status: 404 })

    const res = await cancelSubscriptionPurchase(purchaseId, customer.id)
    if (!res.ok) return NextResponse.json({ success: false, error: "No pending request to cancel." }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error("[laundry-subscription/cancel] POST", e)
    return NextResponse.json({ success: false, error: "Failed to cancel" }, { status: 500 })
  }
}
