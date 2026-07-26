// POST /api/laundry/executive/jobs/[id]/delivery-bag — the delivery executive
// scans (camera) or enters the bag the order goes out in, BEFORE navigating.
// Chain of custody: nothing leaves the store until a bag is recorded, and the
// store scans this same bag back after delivery. Accepts any code; if it matches
// a reusable bag we normalise to its bagNumber, else the manual code is kept.
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
    const code = String(b.code || b.bagNumber || b.qrValue || "").trim()
    if (!code) return NextResponse.json({ error: "Scan or enter a bag" }, { status: 400 })

    const order = await prisma.laundryOrder.findFirst({
      where: { id, businessId: session.businessId },
      select: { id: true, deliveryExecutiveId: true, status: true, deliveryCompletedAt: true },
    })
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })
    if (order.deliveryExecutiveId !== session.executiveId) return NextResponse.json({ error: "This delivery is not assigned to you" }, { status: 403 })
    if (order.deliveryCompletedAt) return NextResponse.json({ error: "Delivery already completed" }, { status: 409 })

    // Normalise to a reusable bag number when the code matches one.
    const bag = await prisma.laundryBag.findFirst({ where: { businessId: session.businessId, OR: [{ bagNumber: code }, { qrValue: code }] }, select: { bagNumber: true } })
    const bagNumber = bag?.bagNumber || code

    await prisma.laundryOrder.update({ where: { id: order.id }, data: { deliveryBagNumber: bagNumber, deliveryBagAssignedAt: new Date() } })
    await logFieldEvent({ orderId: order.id, businessId: session.businessId, action: "DELIVERY_BAG_ASSIGNED", note: `Delivery bag ${bagNumber}`, actor: { id: session.executiveId, name: b.executiveName ?? "Executive" } })

    return NextResponse.json({ success: true, bagNumber })
  } catch (e) {
    console.error("[executive-delivery-bag] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
