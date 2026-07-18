// POST /api/laundry/executive/jobs/[id]/assign-bag — scan a reusable bag and
// assign it to a service on this order. Reuses the SHARED bag-assignment engine
// (assignBagToOrder) — the exact same logic the Admin uses. One bag = one
// service. Also nudges the live field status to "pickup in progress" + logs it.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveExecutive, bearerToken } from "@/lib/laundry-executive-auth"
import { assignBagToOrder } from "@/lib/laundry-bag-assign"
import { logFieldEvent, FIELD_STATUS } from "@/lib/laundry-field-ops"

export const runtime = "nodejs"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await resolveExecutive(bearerToken(request))
    if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    const b = await request.json().catch(() => ({}))
    const code = String(b.code || b.bagNumber || b.qrValue || "").trim()
    if (!code) return NextResponse.json({ error: "Scan a bag" }, { status: 400 })

    const order = await prisma.laundryOrder.findFirst({ where: { id, businessId: session.businessId }, select: { id: true, pickupExecutiveId: true, fieldStatus: true } })
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })
    if (order.pickupExecutiveId !== session.executiveId) return NextResponse.json({ error: "This pickup is not assigned to you" }, { status: 403 })

    const r = await assignBagToOrder({ lbId: session.businessId, code, orderId: order.id, serviceId: b.serviceId ? String(b.serviceId) : null, serviceName: b.serviceName })
    if (!r.ok) return NextResponse.json({ success: false, error: r.error }, { status: r.status })

    if (order.fieldStatus !== FIELD_STATUS.PICKUP_STARTED) {
      await prisma.laundryOrder.update({ where: { id: order.id }, data: { fieldStatus: FIELD_STATUS.PICKUP_STARTED } })
    }
    await logFieldEvent({ orderId: order.id, businessId: session.businessId, action: "BAG_ASSIGNED", note: `${b.serviceName || "Service"}: ${r.bag.bagNumber}`, actor: { id: session.executiveId, name: b.executiveName ?? "Executive" } })
    return NextResponse.json({ success: true, bagNumber: r.bag.bagNumber })
  } catch (e) {
    console.error("[executive-assign-bag] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
