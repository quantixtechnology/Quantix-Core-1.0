// GET  /api/laundry/executive/jobs/[id]/delivery-bags — the order's final bag
//      set with per-bag confirmation state.
// POST /api/laundry/executive/jobs/[id]/delivery-bags { code } — confirm one.
//
// Thin transport over the already-tested domain layer. Every rule —
// tenant, order membership, lifecycle, duplicate handling, the N-of-M gate —
// lives in deliveryBags()/confirmDeliveryBag() and is NOT restated here.
//
// Separate from the existing …/delivery-bag (singular), which is the different,
// earlier step: the custody scan before the executive navigates. That route and
// LaundryOrder.deliveryBagNumber are untouched.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveExecutive } from "@/lib/laundry-executive-auth"
import { deliveryBags, confirmDeliveryBag } from "@/lib/laundry-delivery-bags"

export const runtime = "nodejs"

/** The job must exist, belong to this business, and be assigned to this executive. */
async function guardJob(request: Request, id: string) {
  const session = await resolveExecutive(request)
  if (!session) return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) }
  const order = await prisma.laundryOrder.findFirst({
    where: { id, businessId: session.businessId },
    select: { id: true, deliveryExecutiveId: true, deliveryCompletedAt: true },
  })
  if (!order) return { error: NextResponse.json({ error: "Order not found" }, { status: 404 }) }
  if (order.deliveryExecutiveId !== session.executiveId) {
    return { error: NextResponse.json({ error: "This delivery is not assigned to you" }, { status: 403 }) }
  }
  return { session, order }
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const g = await guardJob(request, id)
    if ("error" in g) return g.error
    return NextResponse.json({ success: true, data: await deliveryBags(g.session.businessId, g.order.id) })
  } catch (e) {
    console.error("[executive-delivery-bags] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const g = await guardJob(request, id)
    if ("error" in g) return g.error
    if (g.order.deliveryCompletedAt) return NextResponse.json({ error: "Delivery already completed" }, { status: 409 })

    const b = await request.json().catch(() => ({}))
    const res = await confirmDeliveryBag({
      lbId: g.session.businessId,
      orderId: g.order.id,
      code: String(b.code || b.bagNumber || b.qrValue || ""),
      actor: { id: g.session.executiveId, name: b.executiveName ?? "Executive", role: "DELIVERY_EXECUTIVE" },
    })
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status })

    // Always answer with the server's own view — the client never computes progress.
    return NextResponse.json({ success: true, data: { ...await deliveryBags(g.session.businessId, g.order.id), scanned: res.bagNumber, alreadyConfirmed: res.alreadyConfirmed } })
  } catch (e) {
    console.error("[executive-delivery-bags] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
