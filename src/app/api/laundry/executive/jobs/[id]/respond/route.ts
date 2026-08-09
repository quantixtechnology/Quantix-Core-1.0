// POST /api/laundry/executive/jobs/[id]/respond — the executive Accepts or
// Rejects an assignment (the dedicated assignment layer, before any field work).
//   { action: "accept" | "reject", type?: "pickup" | "delivery" }
// Accept → acceptance ACCEPTED (job can now be started). Reject → acceptance
// REJECTED, the executive is cleared so the job returns to "Awaiting Assignment"
// for the supervisor to reassign. Both are written to the order timeline.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveExecutive, bearerToken } from "@/lib/laundry-executive-auth"
import { logFieldEvent } from "@/lib/laundry-field-ops"

export const runtime = "nodejs"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await resolveExecutive(bearerToken(request))
    if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    const b = await request.json().catch(() => ({}))
    const type = b.type === "delivery" ? "delivery" : "pickup"
    const accept = b.action === "accept"
    if (b.action !== "accept" && b.action !== "reject") return NextResponse.json({ error: "Invalid action" }, { status: 400 })

    const order = await prisma.laundryOrder.findFirst({
      where: { id, businessId: session.businessId },
      select: { id: true, pickupExecutiveId: true, deliveryExecutiveId: true, pickupCompletedAt: true, deliveryCompletedAt: true, status: true },
    })
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })
    // Audit immutability: once a leg is completed the assigned executive is
    // permanent history — accepting/rejecting afterwards cannot alter it.
    if (type === "pickup" && order.pickupCompletedAt) {
      return NextResponse.json({ error: "Pickup already completed — the assignment is part of the permanent record" }, { status: 409 })
    }
    if (type === "delivery" && (order.deliveryCompletedAt || order.status === "DELIVERED")) {
      return NextResponse.json({ error: "Delivery already completed — the assignment is part of the permanent record" }, { status: 409 })
    }
    const assignedTo = type === "delivery" ? order.deliveryExecutiveId : order.pickupExecutiveId
    if (assignedTo !== session.executiveId) return NextResponse.json({ error: "This job is not assigned to you" }, { status: 403 })

    // AUTHORITATIVE reject check. DeliveryExecutive.canReject is the single
    // source of truth; the PWA hides the button from it, but this is what makes
    // the rule real — a hand-rolled request is refused here.
    // Fails CLOSED: an executive row that cannot be read denies the reject
    // rather than letting it through.
    if (!accept) {
      const exec = await prisma.laundryDeliveryExecutive.findUnique({ where: { id: session.executiveId }, select: { canReject: true } })
      if (!exec?.canReject) return NextResponse.json({ error: "You are not allowed to reject assignments" }, { status: 403 })
    }

    const actor = { id: session.executiveId, name: b.executiveName ?? "Executive" }
    const P = type === "delivery"
    if (accept) {
      await prisma.laundryOrder.update({ where: { id: order.id }, data: P ? { deliveryAcceptance: "ACCEPTED", deliveryAcceptedAt: new Date() } : { pickupAcceptance: "ACCEPTED", pickupAcceptedAt: new Date() } })
      await logFieldEvent({ orderId: order.id, businessId: session.businessId, action: P ? "DELIVERY_ACCEPTED" : "PICKUP_ACCEPTED", note: `${P ? "Delivery" : "Pickup"} accepted by ${actor.name}`, actor })
    } else {
      // Reject → clear the executive so it returns to Awaiting Assignment.
      await prisma.laundryOrder.update({ where: { id: order.id }, data: P
        ? { deliveryAcceptance: "REJECTED", deliveryAcceptedAt: null, deliveryExecutiveId: null, deliveryAssignedAt: null }
        : { pickupAcceptance: "REJECTED", pickupAcceptedAt: null, pickupExecutiveId: null, pickupAssignedAt: null, fieldStatus: null } })
      await logFieldEvent({ orderId: order.id, businessId: session.businessId, action: P ? "DELIVERY_REJECTED" : "PICKUP_REJECTED", note: `${P ? "Delivery" : "Pickup"} rejected by ${actor.name} — returned to Awaiting Assignment`, actor })
    }
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error("[executive-respond] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
