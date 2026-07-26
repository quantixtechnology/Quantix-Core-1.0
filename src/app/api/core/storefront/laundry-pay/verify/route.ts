// POST /api/core/storefront/laundry-pay/verify
//   { businessId, laundryOrderId, razorpay_payment_id, razorpay_order_id, razorpay_signature }
// Verifies the Razorpay signature with the BUSINESS's secret, then records the
// payment against the laundry order (LaundryPayment + amountPaid/balanceDue/
// paymentStatus). This is the single place a storefront online payment is booked.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { decrypt } from "@/lib/encrypt"
import { createHmac } from "crypto"

export const runtime = "nodejs"
const r2 = (n: number) => Math.round(n * 100) / 100

export async function POST(request: Request) {
  try {
    const b = await request.json().catch(() => ({}))
    const { businessId, laundryOrderId, razorpay_payment_id, razorpay_order_id, razorpay_signature } = b
    if (!businessId || !laundryOrderId || !razorpay_payment_id || !razorpay_order_id || !razorpay_signature)
      return NextResponse.json({ success: false, error: "Missing payment fields" }, { status: 400 })
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 })

    const gw = await prisma.laundryPaymentGateway.findFirst({ where: { businessId: biz.id, gateway: "razorpay", secretKeyEnc: { not: null } } })
    if (!gw || !gw.secretKeyEnc) return NextResponse.json({ success: false, error: "Gateway not configured" }, { status: 400 })
    const secret = decrypt(gw.secretKeyEnc)
    const expected = createHmac("sha256", secret).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest("hex")
    if (expected !== razorpay_signature) return NextResponse.json({ success: false, error: "Payment verification failed" }, { status: 400 })

    const order = await prisma.laundryOrder.findFirst({ where: { id: laundryOrderId, businessId: biz.id }, select: { id: true, orderNumber: true, grandTotal: true, amountPaid: true, balanceDue: true } })
    if (!order) return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 })

    // Idempotent: if this payment id is already booked, don't double-count.
    const dup = await prisma.laundryPayment.findFirst({ where: { orderId: order.id, reference: razorpay_payment_id }, select: { id: true } })
    if (!dup) {
      const pay = r2(Math.max(0, order.balanceDue ?? (order.grandTotal - order.amountPaid)))
      const newPaid = r2((order.amountPaid || 0) + pay)
      const newBalance = r2(Math.max(0, order.grandTotal - newPaid))
      await prisma.$transaction([
        prisma.laundryPayment.create({ data: { orderId: order.id, businessId: biz.id, method: "UPI", amount: pay, reference: razorpay_payment_id, note: "Online payment (Razorpay) via storefront", createdBy: "Customer" } }),
        prisma.laundryOrder.update({ where: { id: order.id }, data: { amountPaid: newPaid, balanceDue: newBalance, paymentStatus: newBalance <= 0 ? "PAID" : "PARTIAL" } }),
      ])
    }
    return NextResponse.json({ success: true, data: { orderNumber: order.orderNumber, paid: true } })
  } catch (e) {
    console.error("[laundry-pay verify] POST", e)
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 })
  }
}
