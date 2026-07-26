import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { logFieldEvent } from "@/lib/laundry-field-ops"

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
      select: { id: true, status: true, deliveryRequired: true, deliveryExecutiveId: true, deliveryCompletedAt: true },
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
        select: { name: true },
      })
      if (!ex) return NextResponse.json({ error: "Executive not found or inactive" }, { status: 404 })
      execName = ex.name
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
