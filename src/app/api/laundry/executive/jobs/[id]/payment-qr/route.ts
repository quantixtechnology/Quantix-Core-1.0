// POST /api/laundry/executive/jobs/[id]/payment-qr — the delivery executive
// generates a UPI payment QR (via the business's Razorpay account) for the order
// balance; the customer scans it with any UPI app. No webhook needed — the app
// polls /payment-status with the returned qrCodeId to book it once paid.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveExecutive, bearerToken } from "@/lib/laundry-executive-auth"
import { decrypt } from "@/lib/encrypt"

export const runtime = "nodejs"
const RZP = "https://api.razorpay.com/v1"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await resolveExecutive(bearerToken(request))
    if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

    const order = await prisma.laundryOrder.findFirst({ where: { id, businessId: session.businessId }, select: { id: true, orderNumber: true, grandTotal: true, amountPaid: true, balanceDue: true, deliveryExecutiveId: true } })
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })
    if (order.deliveryExecutiveId !== session.executiveId) return NextResponse.json({ error: "This delivery is not assigned to you" }, { status: 403 })
    const due = Math.round(Math.max(0, (order.balanceDue ?? order.grandTotal - order.amountPaid)) * 100) / 100
    if (due <= 0) return NextResponse.json({ success: false, error: "Nothing to collect" }, { status: 400 })

    const gw = await prisma.laundryPaymentGateway.findFirst({ where: { businessId: session.businessId, isActive: true, gateway: "razorpay", apiKeyEnc: { not: null }, secretKeyEnc: { not: null } } })
    if (!gw || !gw.apiKeyEnc || !gw.secretKeyEnc) return NextResponse.json({ success: false, error: "Online payment (QR) isn't configured — collect cash instead." }, { status: 400 })
    const keyId = decrypt(gw.apiKeyEnc); const secret = decrypt(gw.secretKeyEnc)
    const auth = Buffer.from(`${keyId}:${secret}`).toString("base64")

    const res = await fetch(`${RZP}/payments/qr_codes`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
      body: JSON.stringify({ type: "upi_qr", name: `Order ${order.orderNumber}`, usage: "single_use", fixed_amount: true, payment_amount: Math.round(due * 100), description: `Balance for ${order.orderNumber}`, notes: { laundryOrderId: order.id } }),
    })
    const rj = await res.json().catch(() => ({}))
    if (!res.ok || !rj.id || !rj.image_url) {
      console.error("[executive-payment-qr] razorpay", rj)
      return NextResponse.json({ success: false, error: (rj?.error?.description as string) || "Could not create QR" }, { status: 502 })
    }
    return NextResponse.json({ success: true, data: { qrCodeId: rj.id, imageUrl: rj.image_url, amount: due } })
  } catch (e) {
    console.error("[executive-payment-qr] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
