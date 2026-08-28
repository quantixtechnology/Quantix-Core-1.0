// POST /api/laundry/orders/[id]/store-receive — Received back at Store.
// The origin store confirms the returned processed order (garment count
// verification + optional discrepancy note) and the order becomes
// READY_FOR_DELIVERY. Only a RETURN_IN_TRANSIT order can be received.
//
// Body: { businessId, actorId?, actorName?, note? }
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { guardStatusWrite } from "@/lib/laundry-order-state"
import { releaseBagsForOrder } from "@/lib/laundry-bag-assign"
import { syncPackageLifecycle } from "@/lib/laundry-finishing"
import { ensureDeliveryVerification } from "@/lib/laundry-verification"
import { notifyDeliveryOtpGenerated } from "@/lib/laundry-notify"
import { getTransportMode, transportRefForOrder } from "@/lib/laundry-transport-server"
import { transportRefLabel } from "@/lib/laundry-transport"

export const runtime = "nodejs"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const b = await request.json().catch(() => ({}))
    const guard = await requireLaundryPermission(request, b.businessId, "store_ops.store_receive.operate")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(b.businessId)
    if (!biz) return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })

    const order = await prisma.laundryOrder.findFirst({
      where: { id, businessId: biz.id },
      select: { id: true, orderNumber: true, status: true, packet: { select: { id: true } }, _count: { select: { items: true } } },
    })
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })
    if (order.status !== "RETURN_IN_TRANSIT") {
      return NextResponse.json({ error: order.status === "READY_FOR_DELIVERY" ? "Order already received at store" : `Order is not in return transit (current: ${order.status})` }, { status: 409 })
    }

    // Audit note names the package by whatever Transport Setup uses (bag / packet).
    const mode = await getTransportMode(biz.id, "PROCESSING_TO_STORE")
    const ref = await transportRefForOrder(biz.id, order.id, mode)

    const now = new Date()
    // STATE INVARIANTS — shared server guard (src/lib/laundry-order-state.ts).
    // The operational checks above own the physical action; this owns the
    // workflow claim, so no endpoint can advance an order past work that
    // never happened.
    const stateGate = await guardStatusWrite({ orderId: order.id, businessId: biz.id, from: "RETURN_IN_TRANSIT", to: "READY_FOR_DELIVERY", allowInternal: true })
    if (!stateGate.ok) return NextResponse.json({ error: stateGate.error, code: stateGate.code }, { status: 409 })

    const advanced = await prisma.laundryOrder.updateMany({
      where: { id: order.id, status: "RETURN_IN_TRANSIT" },
      data: { status: "READY_FOR_DELIVERY" },
    })
    if (advanced.count === 0) return NextResponse.json({ error: "Order already received at store" }, { status: 409 })

    if (order.packet) {
      await prisma.laundryPacket.update({
        where: { id: order.packet.id },
        data: { status: "RETURNED_TO_STORE", returnReceivedBy: b.actorName || null, returnReceivedAt: now },
      })
    }
    await prisma.laundryOrderEvent.create({
      data: {
        orderId: order.id, businessId: biz.id,
        fromStatus: "RETURN_IN_TRANSIT", toStatus: "READY_FOR_DELIVERY", action: "RECEIVE_AT_STORE",
        actorId: b.actorId || null, actorName: b.actorName || null,
        note: b.note || `${order._count.items} garment(s) verified at store${transportRefLabel(ref) ? ` · ${transportRefLabel(ref)}` : ""}`,
      },
    }).catch(() => null)

    // Keep the reusable bags' lifecycle in step with the order (display accuracy).
    // SCENARIO 3 — the bag that carried processed garments back from the
    // Processing Center is emptied here, so it is free now. It must NOT wait for
    // Ready for Delivery or the delivery run: a different bag carries the order
    // to the customer.
    const bagsReleased = await releaseBagsForOrder(biz.id, order.id).catch(() => 0)
    // Processing packages remain RELEASED (received at store, awaiting delivery).
    await syncPackageLifecycle(order.id, biz.id).catch(() => null)

    // Delivery verification (Workflow Settings): the order is now READY_FOR_DELIVERY —
    // snapshot the method and generate the Delivery OTP. Best-effort + non-fatal.
    try {
      const dv = await ensureDeliveryVerification(biz.id, order.id)
      if (dv.method === "OTP" && dv.otp) {
        await notifyDeliveryOtpGenerated(order.id, biz.id, dv.otp)
      }
    } catch (e) {
      console.error("[laundry-order-store-receive] delivery verification init failed:", e)
    }

    return NextResponse.json({ success: true, mode, data: { orderNumber: order.orderNumber, transport: ref, transportCode: ref.code, bagsReleased } })
  } catch (e) {
    console.error("[laundry-order-store-receive] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
