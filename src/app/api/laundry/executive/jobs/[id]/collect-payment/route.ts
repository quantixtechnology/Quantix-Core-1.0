// POST /api/laundry/executive/jobs/[id]/collect-payment { method?, executiveName }
// The delivery executive records the balance collected at the door (cash by
// default) so the delivery can be handed over. Books the payment on the order.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveExecutive, bearerToken } from "@/lib/laundry-executive-auth"
import { recordLaundryPayment } from "@/lib/laundry-payment-record"
import { logFieldEvent } from "@/lib/laundry-field-ops"

export const runtime = "nodejs"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await resolveExecutive(bearerToken(request))
    if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    const b = await request.json().catch(() => ({}))
    const method = ["CASH", "UPI", "CARD", "WALLET"].includes(String(b.method)) ? String(b.method) : "CASH"

    const order = await prisma.laundryOrder.findFirst({ where: { id, businessId: session.businessId }, select: { id: true, deliveryExecutiveId: true, deliveryCompletedAt: true } })
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })
    if (order.deliveryExecutiveId !== session.executiveId) return NextResponse.json({ error: "This delivery is not assigned to you" }, { status: 403 })

    const r = await recordLaundryPayment({ orderId: order.id, businessId: session.businessId, method, note: `${method} collected at delivery`, createdBy: b.executiveName || "Executive" })
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 })
    await logFieldEvent({ orderId: order.id, businessId: session.businessId, action: "PAYMENT_COLLECTED", note: `${method} collected — balance ₹${r.balanceDue.toFixed(2)}`, actor: { id: session.executiveId, name: b.executiveName ?? "Executive" } })

    return NextResponse.json({ success: true, data: { balanceDue: r.balanceDue, paid: r.balanceDue <= 0, paymentStatus: r.paymentStatus } })
  } catch (e) {
    console.error("[executive-collect-payment] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
