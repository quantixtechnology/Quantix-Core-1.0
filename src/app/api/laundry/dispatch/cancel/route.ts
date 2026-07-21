import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { logFieldEvent } from "@/lib/laundry-field-ops"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { businessId, orderId, type, reason } = body
    if (!businessId || !orderId || !type)
      return NextResponse.json({ error: "businessId, orderId, and type (pickup|delivery) required" }, { status: 400 })

    const guard = await requireLaundryPermission(request, businessId, "laundry.orders.edit")
    if (!guard.ok) return guard.res

    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })

    const order = await prisma.laundryOrder.findFirst({
      where: { id: orderId, businessId: biz.id },
      select: { id: true },
    })
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })

    if (type === "pickup") {
      await prisma.laundryOrder.update({
        where: { id: order.id },
        data: {
          pickupExecutiveId: null, pickupAssignedAt: null,
          pickupAcceptance: null, pickupAcceptedAt: null,
          pickupStartedAt: null, pickupCompletedAt: null,
          fieldStatus: null,
        },
      })
      await logFieldEvent({
        orderId: order.id, businessId: biz.id,
        action: "PICKUP_CANCELLED",
        note: reason || "Pickup cancelled",
        actor: { id: guard.ctx?.userId ?? null, name: guard.ctx?.userName ?? "Staff" },
      })
    } else {
      await prisma.laundryOrder.update({
        where: { id: order.id },
        data: {
          deliveryExecutiveId: null, deliveryAssignedAt: null,
          deliveryAcceptance: null, deliveryAcceptedAt: null,
          deliveryStartedAt: null, deliveryCompletedAt: null,
          fieldStatus: null,
        },
      })
      await logFieldEvent({
        orderId: order.id, businessId: biz.id,
        action: "DELIVERY_CANCELLED",
        note: reason || "Delivery cancelled",
        actor: { id: guard.ctx?.userId ?? null, name: guard.ctx?.userName ?? "Staff" },
      })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error("[dispatch/cancel] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
