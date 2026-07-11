// GET /api/laundry/app/orders/[orderId] — order detail: live tracking timeline
// (real workflow events — no invented statuses), garments, payments and an
// invoice split (Phases 6/7). Read-only against the frozen workflow/billing.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveSession, bearerToken } from "@/lib/laundry-app-auth"

export const runtime = "nodejs"
const r2 = (n: number) => Math.round(n * 100) / 100

// Canonical customer-facing tracking sequence (maps 1:1 to real order statuses).
const TRACK: { status: string; label: string }[] = [
  { status: "PENDING_STORE_AUDIT", label: "Order Received" },
  { status: "PAYMENT_PENDING", label: "Store Audit" },
  { status: "READY_FOR_PROCESSING", label: "Packing" },
  { status: "PACKED", label: "Packed" },
  { status: "IN_TRANSIT_TO_PROCESSING", label: "Transit to Processing" },
  { status: "PROCESSING", label: "Processing" },
  { status: "RETURN_IN_TRANSIT", label: "Returning to Store" },
  { status: "READY_FOR_DELIVERY", label: "Ready for Delivery" },
  { status: "DELIVERED", label: "Delivered" },
]

export async function GET(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const sess = await resolveSession(bearerToken(request))
  if (!sess) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const { orderId } = await params
  const order = await prisma.laundryOrder.findFirst({
    where: { id: orderId, customerId: sess.customerId },
    select: {
      id: true, orderNumber: true, status: true, orderType: true, createdAt: true, expectedDeliveryDate: true, deliveredAt: true,
      grandTotal: true, amountPaid: true, balanceDue: true, subscriptionCoveredAmount: true, paymentStatus: true,
      pickupAddress: true, specialInstructions: true,
      items: { orderBy: { itemNumber: "asc" }, select: { itemNumber: true, garmentName: true, serviceName: true, quantity: true, processingStage: true, processingStatus: true, total: true } },
    },
  })
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })

  const [events, payments] = await Promise.all([
    prisma.laundryOrderEvent.findMany({ where: { orderId: order.id }, orderBy: { createdAt: "asc" }, select: { toStatus: true, action: true, note: true, createdAt: true } }),
    prisma.laundryPayment.findMany({ where: { orderId: order.id }, orderBy: { createdAt: "asc" }, select: { method: true, amount: true, reference: true, createdAt: true } }),
  ])

  const idx = TRACK.findIndex((t) => t.status === order.status)
  const cancelled = order.status === "CANCELLED"
  const tracking = TRACK.map((t, i) => ({ ...t, done: !cancelled && idx >= 0 && i <= idx, current: !cancelled && i === idx }))

  return NextResponse.json({ success: true, data: {
    order: { id: order.id, orderNumber: order.orderNumber, status: order.status, orderType: order.orderType, createdAt: order.createdAt, expectedDeliveryDate: order.expectedDeliveryDate, deliveredAt: order.deliveredAt, pickupAddress: order.pickupAddress, specialInstructions: order.specialInstructions },
    items: order.items.map((i) => ({ ...i })),
    tracking, cancelled,
    timeline: events.map((e) => ({ at: e.createdAt, status: e.toStatus, action: e.action, note: e.note })),
    invoice: {
      total: r2(order.grandTotal), subscriptionCovered: r2(order.subscriptionCoveredAmount || 0),
      paid: r2(order.amountPaid), balance: r2(order.balanceDue), paymentStatus: order.paymentStatus,
      payments: payments.map((p) => ({ ...p, amount: r2(p.amount) })),
    },
  } })
}
