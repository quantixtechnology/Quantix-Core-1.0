// POST /api/laundry/orders/[id]/payment
// Phase 4 — Payment Collection. Records a payment against the order's PERSISTED
// totals (never recalculates pricing) and updates the running summary
// (amountPaid / balanceDue / paymentStatus).
//
// Body: { businessId, method, amount, reference?, note?, createdBy? }
//   method: CASH | UPI | CARD | WALLET | CREDIT | SUBSCRIPTION | PARTIAL
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"

export const runtime = "nodejs"

const METHODS = new Set(["CASH", "UPI", "CARD", "WALLET", "CREDIT", "SUBSCRIPTION", "PARTIAL"])

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { businessId, method, amount, reference, note, createdBy } = body

    if (!businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
    if (!method || !METHODS.has(method)) return NextResponse.json({ error: "Invalid payment method" }, { status: 400 })
    const amt = Number(amount)
    if (!Number.isFinite(amt) || amt <= 0) return NextResponse.json({ error: "Amount must be greater than zero" }, { status: 400 })

    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })

    const order = await prisma.laundryOrder.findFirst({
      where: { id, businessId: biz.id },
      select: { id: true, grandTotal: true, amountPaid: true },
    })
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })

    // Reads PERSISTED totals — pricing is never recomputed here.
    const newPaid = Math.round((order.amountPaid + amt) * 100) / 100
    const balanceDue = Math.round(Math.max(0, order.grandTotal - newPaid) * 100) / 100
    const paymentStatus = newPaid <= 0 ? "UNPAID" : balanceDue <= 0 ? "PAID" : "PARTIAL"

    const [payment, updated] = await prisma.$transaction([
      prisma.laundryPayment.create({
        data: { orderId: order.id, businessId: biz.id, method, amount: amt, reference: reference || null, note: note || null, createdBy: createdBy || null },
      }),
      prisma.laundryOrder.update({
        where: { id: order.id },
        data: { amountPaid: newPaid, balanceDue, paymentStatus },
        include: { payments: { orderBy: { createdAt: "desc" } } },
      }),
    ])

    return NextResponse.json({ success: true, data: { payment, order: updated } }, { status: 201 })
  } catch (e) {
    console.error("[laundry-order-payment] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
