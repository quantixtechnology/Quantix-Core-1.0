// POST /api/laundry/orders/[id]/dispatch — Transit to Processing Center.
// Records the transit state (dispatched by/at/note) against the order's
// transport identity — the packet or the bag, per Transport Setup — and
// advances PACKED → IN_TRANSIT_TO_PROCESSING. Duplicate dispatch is blocked by
// the status guard.
//
// Body: { businessId, actorId?, actorName?, note?, transportBy? }
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { getTransportMode, transportRefForOrder } from "@/lib/laundry-transport-server"
import { transportNoun, transportRefLabel } from "@/lib/laundry-transport"
import { resolveProcessingCenterId } from "@/lib/laundry-store-eligibility"

export const runtime = "nodejs"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const b = await request.json().catch(() => ({}))
    const guard = await requireLaundryPermission(request, b.businessId, "store_ops.transit.operate")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(b.businessId)
    if (!biz) return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })

    const order = await prisma.laundryOrder.findFirst({
      where: { id, businessId: biz.id },
      select: {
        id: true, orderNumber: true, status: true, packet: { select: { id: true } },
        processingCenterStoreId: true,
        // The store's CURRENT assignment — read once, here, and frozen below.
        store: { select: { id: true, storeType: true, processingCenterStoreId: true } },
      },
    })
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })

    const mode = await getTransportMode(biz.id, "STORE_TO_PROCESSING")
    const noun = transportNoun(mode)
    const ref = await transportRefForOrder(biz.id, order.id, mode)
    if (!ref.code) {
      return NextResponse.json({
        error: mode === "BAG"
          ? "No bag on this order — scan the laundry bag at Packing before dispatch."
          : "Order has not been packed yet — create the packet first",
      }, { status: 409 })
    }
    if (order.status !== "PACKED") {
      return NextResponse.json({ error: order.status === "IN_TRANSIT_TO_PROCESSING" ? `${noun} already dispatched` : `Order is not packed (current: ${order.status})` }, { status: 409 })
    }

    const note = [b.transportBy ? `Transport: ${b.transportBy}` : null, b.note || null].filter(Boolean).join(" · ") || null
    const now = new Date()
    // Atomic: only the first dispatch wins.
    const advanced = await prisma.laundryOrder.updateMany({
      where: { id: order.id, status: "PACKED" },
      data: { status: "IN_TRANSIT_TO_PROCESSING" },
    })
    if (advanced.count === 0) return NextResponse.json({ error: `${noun} already dispatched` }, { status: 409 })

    // ── Freeze the Processing Center on the order ────────────────────────────
    // THIS is the operational commit point: the garments physically leave the
    // store for a centre. The store's current assignment is copied onto the
    // order now, so reassigning the store later cannot rewrite what already
    // happened. Written once — a re-dispatch never overwrites the original.
    if (!order.processingCenterStoreId && order.store) {
      const centreId = resolveProcessingCenterId(order.store)
      if (centreId) {
        const centre = await prisma.laundryStore.findUnique({
          where: { id: centreId },
          select: { id: true, storeCode: true, storeName: true },
        })
        if (centre) {
          await prisma.laundryOrder.update({
            where: { id: order.id },
            data: {
              processingCenterStoreId: centre.id,
              // Code and name frozen too: renaming the centre later must not
              // change what this record says happened.
              processingCenterCode: centre.storeCode,
              processingCenterName: centre.storeName,
              processingCenterAt: now,
            },
          }).catch(() => null)
        }
      }
    }

    // Packet transit state is kept in step whenever the order carries a packet
    // (packet mode, or an order packed before the business switched to BAG).
    if (order.packet) {
      await prisma.laundryPacket.update({
        where: { orderId: order.id },
        data: { status: "IN_TRANSIT_TO_PC", dispatchedBy: b.actorName || null, dispatchedAt: now, dispatchNote: note },
      })
    }
    await prisma.laundryOrderEvent.create({
      data: {
        orderId: order.id, businessId: biz.id,
        fromStatus: "PACKED", toStatus: "IN_TRANSIT_TO_PROCESSING", action: "DISPATCH_TO_PROCESSING",
        actorId: b.actorId || null, actorName: b.actorName || null,
        note: note || `${transportRefLabel(ref)} in transit`,
      },
    }).catch(() => null)

    return NextResponse.json({ success: true, mode, data: { orderNumber: order.orderNumber, transport: ref, transportCode: ref.code, dispatchedAt: now } })
  } catch (e) {
    console.error("[laundry-order-dispatch] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
