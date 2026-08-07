// POST /api/laundry/orders/[id]/pack — Packing & QR Generation.
// Advances READY_FOR_PROCESSING → PACKED and stamps the package's transport
// identity. WHICH identity is decided solely by Transport Setup
// (Store → Processing Center):
//   PACKET / BOTH → creates the persistent packet (PKT-{orderNumber}, one per
//                   order) whose QR payload is the packet number.
//   BAG           → NO packet is ever generated; the reusable bag already
//                   assigned to the order IS the transport identifier.
// Idempotent in both modes: a double-click returns the existing identity.
//
// Body: { businessId, actorId?, actorName?, note? }
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { generatePacketNumber } from "@/lib/laundry-codes"
import { checkAuditComplete } from "@/lib/laundry-audit"
import { getTransportMode, transportRefForOrder } from "@/lib/laundry-transport-server"
import { transportNoun, transportRefLabel, usesPacket, type TransportRef } from "@/lib/laundry-transport"

export const runtime = "nodejs"

type PacketRow = { packetNumber: string; qrValue: string; itemCount: number; packedBy: string | null; packedAt: Date }

// One response shape for every mode. `transport` is the ONLY identity exposed —
// callers never see a raw packet number, so a BAG-mode screen cannot render one.
function payload(ref: TransportRef, packet: PacketRow | null, itemCount: number, packedBy: string | null, packedAt: Date) {
  return {
    transport: ref,
    qrValue: ref.qrValue ?? packet?.qrValue ?? null,
    itemCount: packet?.itemCount ?? itemCount,
    packedBy: packet?.packedBy ?? packedBy,
    packedAt: packet?.packedAt ?? packedAt,
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const b = await request.json().catch(() => ({}))
    const guard = await requireLaundryPermission(request, b.businessId, "store_ops.packing_qr.operate")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(b.businessId)
    if (!biz) return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })

    const order = await prisma.laundryOrder.findFirst({
      where: { id, businessId: biz.id },
      select: { id: true, orderNumber: true, status: true, storeId: true, _count: { select: { items: true } } },
    })
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })

    const mode = await getTransportMode(biz.id, "STORE_TO_PROCESSING")
    const noun = transportNoun(mode)

    // Idempotency: an order that already carries a packet is already packed —
    // return it (no duplicate), whatever the current mode says.
    const existing = await prisma.laundryPacket.findUnique({ where: { orderId: order.id } })
    if (existing) {
      const ref = await transportRefForOrder(biz.id, order.id, mode)
      return NextResponse.json({ success: true, mode, data: payload(ref, existing, order._count.items, existing.packedBy, existing.packedAt), alreadyPacked: true })
    }
    // BAG mode leaves no packet row behind, so "already packed" is the status.
    if (!usesPacket(mode) && order.status !== "READY_FOR_PROCESSING") {
      if (order.status === "PACKED") {
        const ref = await transportRefForOrder(biz.id, order.id, mode)
        return NextResponse.json({ success: true, mode, data: payload(ref, null, order._count.items, b.actorName || null, new Date()), alreadyPacked: true })
      }
    }

    if (order.status !== "READY_FOR_PROCESSING") {
      return NextResponse.json({ error: `Order is not ready for packing (current: ${order.status})` }, { status: 409 })
    }
    // Audit gate: never stamp a transport identity on an order whose Store Audit
    // is incomplete (missing / un-identified garments) — the package's garment
    // contents would be wrong. Order stays untouched; the auditor must finish.
    const audit = await checkAuditComplete(order.id)
    if (!audit.ok) {
      console.warn(`[laundry-order-pack] blocked ${order.orderNumber}: audit incomplete (expected ${audit.expected}, audited ${audit.audited})`)
      return NextResponse.json({ success: false, code: audit.code, message: audit.message, expected: audit.expected, audited: audit.audited }, { status: 409 })
    }

    let packet: PacketRow | null = null
    if (usesPacket(mode)) {
      const packetNumber = generatePacketNumber(order.orderNumber)
      try {
        packet = await prisma.laundryPacket.create({
          data: {
            packetNumber, businessId: biz.id, storeId: order.storeId, orderId: order.id,
            status: "PACKED", qrValue: packetNumber, itemCount: order._count.items,
            packedBy: b.actorName || null,
          },
        })
      } catch (e: unknown) {
        // Unique constraint (concurrent double-click) → return the winner's packet.
        const existing2 = await prisma.laundryPacket.findUnique({ where: { orderId: order.id } })
        if (!existing2) throw e
        const ref = await transportRefForOrder(biz.id, order.id, mode)
        return NextResponse.json({ success: true, mode, data: payload(ref, existing2, order._count.items, existing2.packedBy, existing2.packedAt), alreadyPacked: true })
      }
    } else {
      // BAG mode: the bag IS the identifier — it must be on the order already.
      const ref = await transportRefForOrder(biz.id, order.id, mode)
      if (!ref.code) {
        return NextResponse.json({ error: "Scan the laundry bag for this order — the bag QR is this business's transport identifier.", code: "TRANSPORT_BAG_REQUIRED" }, { status: 409 })
      }
    }

    // Advance status atomically from the expected state only.
    const ref = await transportRefForOrder(biz.id, order.id, mode)
    const advanced = await prisma.laundryOrder.updateMany({
      where: { id: order.id, status: "READY_FOR_PROCESSING" },
      data: { status: "PACKED" },
    })
    if (advanced.count > 0) {
      await prisma.laundryOrderEvent.create({
        data: {
          orderId: order.id, businessId: biz.id,
          fromStatus: "READY_FOR_PROCESSING", toStatus: "PACKED", action: "PACK_ORDER",
          actorId: b.actorId || null, actorName: b.actorName || null,
          note: b.note || `${transportRefLabel(ref) || noun} · ${order._count.items} garment(s)`,
        },
      }).catch(() => null)
    }

    return NextResponse.json({ success: true, mode, data: payload(ref, packet, order._count.items, b.actorName || null, new Date()) }, { status: 201 })
  } catch (e) {
    console.error("[laundry-order-pack] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
