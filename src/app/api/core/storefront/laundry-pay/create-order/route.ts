// POST /api/core/storefront/laundry-pay/create-order { businessId, laundryOrderId }
// Creates a Razorpay order for a laundry order's balance using the BUSINESS's own
// gateway keys (LaundryPaymentGateway, decrypted server-side). Returns the public
// key id + Razorpay order id for the checkout widget. Secret never leaves here.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { decrypt } from "@/lib/encrypt"

export const runtime = "nodejs"
const RZP = "https://api.razorpay.com/v1"

export async function POST(request: Request) {
  try {
    const b = await request.json().catch(() => ({}))
    if (!b.businessId || !b.laundryOrderId) return NextResponse.json({ success: false, error: "businessId and laundryOrderId are required" }, { status: 400 })
    const biz = await resolveLaundryBusiness(b.businessId)
    if (!biz) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 })

    const order = await prisma.laundryOrder.findFirst({ where: { id: b.laundryOrderId, businessId: biz.id }, select: { id: true, orderNumber: true, grandTotal: true, amountPaid: true, balanceDue: true } })
    if (!order) return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 })
    const due = Math.round(Math.max(0, (order.balanceDue ?? (order.grandTotal - order.amountPaid))) * 100) / 100
    if (due <= 0) return NextResponse.json({ success: false, error: "Nothing to pay" }, { status: 400 })

    const gw = await prisma.laundryPaymentGateway.findFirst({ where: { businessId: biz.id, isActive: true, gateway: "razorpay", apiKeyEnc: { not: null }, secretKeyEnc: { not: null } } })
    if (!gw || !gw.apiKeyEnc || !gw.secretKeyEnc) return NextResponse.json({ success: false, error: "Online payment is not configured" }, { status: 400 })
    const keyId = decrypt(gw.apiKeyEnc)
    const secret = decrypt(gw.secretKeyEnc)
    if (!keyId || !secret) return NextResponse.json({ success: false, error: "Gateway keys unreadable" }, { status: 500 })

    const auth = Buffer.from(`${keyId}:${secret}`).toString("base64")
    const res = await fetch(`${RZP}/orders`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
      body: JSON.stringify({ amount: Math.round(due * 100), currency: "INR", receipt: order.orderNumber, notes: { laundryOrderId: order.id, businessId: biz.id } }),
    })
    const rj = await res.json().catch(() => ({}))
    if (!res.ok || !rj.id) {
      console.error("[laundry-pay create-order] razorpay error", rj)
      return NextResponse.json({ success: false, error: (rj?.error?.description as string) || "Could not start payment" }, { status: 502 })
    }
    return NextResponse.json({ success: true, data: { razorpayOrderId: rj.id, keyId, amount: due, currency: "INR", orderNumber: order.orderNumber } })
  } catch (e) {
    console.error("[laundry-pay create-order] POST", e)
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 })
  }
}
