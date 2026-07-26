// GET /api/laundry/executive/jobs/[id]/payment-status?qrCodeId= — the delivery app
// polls this. Returns the live balance, and if a qrCodeId is given, checks Razorpay
// for a captured payment on that QR and books it (so a customer paying by QR clears
// the balance without a webhook). Also picks up a "pay on their app" payment (the
// order balance already moved via the storefront verify).
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveExecutive, bearerToken } from "@/lib/laundry-executive-auth"
import { decrypt } from "@/lib/encrypt"
import { recordLaundryPayment } from "@/lib/laundry-payment-record"
import { logFieldEvent } from "@/lib/laundry-field-ops"

export const runtime = "nodejs"
const RZP = "https://api.razorpay.com/v1"
const r2 = (n: number) => Math.round(n * 100) / 100

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await resolveExecutive(bearerToken(request))
    if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    const qrCodeId = new URL(request.url).searchParams.get("qrCodeId")

    const order = await prisma.laundryOrder.findFirst({ where: { id, businessId: session.businessId }, select: { id: true, grandTotal: true, amountPaid: true, balanceDue: true, deliveryExecutiveId: true } })
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })
    if (order.deliveryExecutiveId !== session.executiveId) return NextResponse.json({ error: "Not assigned to you" }, { status: 403 })

    let balanceDue = r2(Math.max(0, order.balanceDue ?? order.grandTotal - order.amountPaid))

    // Poll the QR for a captured payment and book it (idempotent by payment id).
    if (qrCodeId && balanceDue > 0) {
      const gw = await prisma.laundryPaymentGateway.findFirst({ where: { businessId: session.businessId, gateway: "razorpay", apiKeyEnc: { not: null }, secretKeyEnc: { not: null } } })
      if (gw?.apiKeyEnc && gw.secretKeyEnc) {
        const auth = Buffer.from(`${decrypt(gw.apiKeyEnc)}:${decrypt(gw.secretKeyEnc)}`).toString("base64")
        const res = await fetch(`${RZP}/payments/qr_codes/${encodeURIComponent(qrCodeId)}/payments`, { headers: { Authorization: `Basic ${auth}` } })
        const rj = await res.json().catch(() => ({}))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const captured = (rj?.items || []).find((p: any) => p.status === "captured")
        if (captured) {
          const r = await recordLaundryPayment({ orderId: order.id, businessId: session.businessId, method: "UPI", amount: (captured.amount || 0) / 100, reference: captured.id, note: "UPI QR at delivery", createdBy: "Customer (QR)" })
          if (r.ok) {
            balanceDue = r.balanceDue
            if (!r.alreadyBooked) await logFieldEvent({ orderId: order.id, businessId: session.businessId, action: "PAYMENT_COLLECTED", note: `UPI QR paid — balance ₹${r.balanceDue.toFixed(2)}`, actor: { id: session.executiveId, name: "QR" } })
          }
        }
      }
    }

    return NextResponse.json({ success: true, data: { balanceDue, paid: balanceDue <= 0 } })
  } catch (e) {
    console.error("[executive-payment-status] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
