import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { logFieldEvent } from "@/lib/laundry-field-ops"
import { assertDeliverySlotAvailable } from "@/lib/laundry-slot-capacity"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { businessId, orderId, executiveId, notes, deliveryDate, deliveryTimeSlot } = body
    if (!businessId || !orderId)
      return NextResponse.json({ error: "businessId and orderId required" }, { status: 400 })

    const guard = await requireLaundryPermission(request, businessId, "laundry.orders.edit")
    if (!guard.ok) return guard.res

    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })

    const order = await prisma.laundryOrder.findFirst({
      where: { id: orderId, businessId: biz.id },
      select: { id: true, status: true, deliveryRequired: true, deliveryExecutiveId: true, deliveryCompletedAt: true, storeId: true },
    })
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })
    if (order.deliveryCompletedAt)
      return NextResponse.json({ error: "Delivery already completed" }, { status: 409 })
    if (order.deliveryExecutiveId && !executiveId)
      return NextResponse.json({ success: true, data: { orderId: order.id, deliveryExecutiveId: order.deliveryExecutiveId }, existing: true, message: "Delivery already scheduled" })

    const execId: string | null = executiveId || null
    let execName: string | null = null
    if (execId) {
      const ex = await prisma.laundryDeliveryExecutive.findFirst({
        where: { id: execId, businessId: biz.id, isActive: true },
        select: { name: true, storeId: true },
      })
      if (!ex) return NextResponse.json({ error: "Executive not found or inactive" }, { status: 404 })
      execName = ex.name
      if (ex.storeId && order.storeId !== ex.storeId) return NextResponse.json({ error: "Executive is restricted to a specific store and cannot be assigned to this order" }, { status: 403 })
    }

    // Slot capacity guard — a full (date + time slot) cannot be assigned, even
    // if the UI is bypassed. The order itself is excluded so rescheduling onto
    // its own slot stays possible.
    if (deliveryDate && deliveryTimeSlot) {
      const check = await assertDeliverySlotAvailable(biz.id, String(deliveryDate), String(deliveryTimeSlot), { excludeOrderId: order.id })
      if (!check.ok) return NextResponse.json({ error: check.error }, { status: 409 })
    }

    // Persist the scheduled date + slot (previously only stuffed into `notes`, so
    // the order and the Dispatch Center showed "—" and the job had no schedule).
    const parsedDate = deliveryDate ? new Date(deliveryDate) : null
    await prisma.laundryOrder.update({
      where: { id: order.id },
      data: {
        deliveryRequired: true,
        deliveryExecutiveId: execId,
        deliveryAssignedAt: execId ? new Date() : null,
        // Track the executive's response so "Awaiting response" is real state.
        deliveryAcceptance: execId ? "PENDING" : null,
        ...(parsedDate && !isNaN(parsedDate.getTime()) ? { deliveryDate: parsedDate } : {}),
        ...(deliveryTimeSlot ? { deliveryTimeSlot: String(deliveryTimeSlot) } : {}),
        notes: notes || null,
      },
    })

    await logFieldEvent({
      orderId: order.id, businessId: biz.id,
      action: execId ? "DELIVERY_ASSIGNED" : "DELIVERY_REQUESTED",
      note: execId ? `Assigned to ${execName}` : "Delivery requested",
      actor: { id: guard.ctx?.userId ?? null, name: guard.ctx?.userName ?? "Staff" },
    })

    return NextResponse.json({
      success: true,
      data: { orderId: order.id, deliveryExecutiveId: execId, deliveryExecutiveName: execName },
    })
  } catch (e) {
    console.error("[dispatch/delivery] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
