// POST /api/laundry/orders/[id]/otp — Business Admin manual recovery for the
// Pickup/Delivery verification OTP (the "no order may get stuck" path).
//   Body: { businessId, kind: "pickup" | "delivery", actorName? }
// Regenerates a fresh OTP, snapshots the method to OTP, and pings the customer
// in-app with the new code. Read-only GET returns the current OTP + method.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { regenerateOtp } from "@/lib/laundry-verification"
import { notifyPickupOtpGenerated, notifyDeliveryOtpGenerated } from "@/lib/laundry-notify"

export const runtime = "nodejs"

const KIND = new Set(["pickup", "delivery"])

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const businessId = new URL(request.url).searchParams.get("businessId")
    if (!businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
    const guard = await requireLaundryPermission(request, businessId, "laundry.orders.view")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ error: "Not found" }, { status: 404 })
    const order = await prisma.laundryOrder.findFirst({
      where: { id, businessId: biz.id },
      select: { pickupOtp: true, deliveryOtp: true, pickupVerificationMethod: true, deliveryVerificationMethod: true },
    })
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })
    return NextResponse.json({
      success: true,
      data: {
        pickup: { method: order.pickupVerificationMethod || "OTP", otp: order.pickupOtp || null },
        delivery: { method: order.deliveryVerificationMethod || "OTP", otp: order.deliveryOtp || null },
      },
    })
  } catch (e) {
    console.error("[laundry-order-otp] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const b = await request.json().catch(() => ({}))
    const kind = b.kind
    if (!KIND.has(kind)) return NextResponse.json({ error: "kind must be 'pickup' or 'delivery'" }, { status: 400 })
    const guard = await requireLaundryPermission(request, b.businessId, "laundry.orders.edit")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(b.businessId)
    if (!biz) return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })

    const r = await regenerateOtp(biz.id, id, kind)
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 409 })

    const order = await prisma.laundryOrder.findFirst({ where: { id, businessId: biz.id }, select: { orderNumber: true } })
    const actorName = b.actorName || null
    await prisma.laundryAuditLog.create({
      data: {
        businessId: biz.id, actorName, section: "ORDER_VERIFICATION",
        field: `${kind}Otp`, oldValue: null, newValue: "REGENERATED", ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
      },
    }).catch(() => null)

    if (kind === "pickup") await notifyPickupOtpGenerated(id, biz.id, r.otp)
    else await notifyDeliveryOtpGenerated(id, biz.id, r.otp)

    return NextResponse.json({ success: true, data: { orderNumber: order?.orderNumber || id, kind, otp: r.otp } })
  } catch (e) {
    console.error("[laundry-order-otp] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
