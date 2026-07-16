// GET  /api/laundry/app/orders — the customer's orders (Phases 6/9)
// POST /api/laundry/app/orders — place an order (Phase 5). Consumes the FROZEN
//   order-creation API (which auto-applies subscription coverage) — it builds
//   no order/pricing/subscription logic of its own.
// Body: { items:[{serviceId, garmentId, quantity, weightKg?}], orderType?, storeId?,
//         pickupDate?, pickupTimeSlot?, pickupAddress?, specialInstructions?, isExpress? }
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveSession, bearerToken } from "@/lib/laundry-app-auth"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { POST as createOrder } from "@/app/api/laundry/orders/route"
import { INTERNAL_HEADER, INTERNAL_TOKEN } from "@/lib/laundry-rbac"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const sess = await resolveSession(bearerToken(request))
  if (!sess) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const orders = await prisma.laundryOrder.findMany({
    where: { customerId: sess.customerId },
    select: { id: true, orderNumber: true, status: true, orderType: true, grandTotal: true, amountPaid: true, balanceDue: true, subscriptionCoveredAmount: true, paymentStatus: true, createdAt: true, expectedDeliveryDate: true, _count: { select: { items: true } } },
    orderBy: { createdAt: "desc" }, take: 50,
  })
  return NextResponse.json({ success: true, data: orders.map((o) => ({ ...o, itemCount: o._count.items })) })
}

export async function POST(request: Request) {
  const sess = await resolveSession(bearerToken(request))
  if (!sess) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const b = await request.json().catch(() => ({}))
  if (!Array.isArray(b.items) || b.items.length === 0) return NextResponse.json({ error: "Add at least one garment" }, { status: 400 })
  const biz = await resolveLaundryBusiness(sess.businessId)
  if (!biz) return NextResponse.json({ error: "Business not found" }, { status: 404 })

  // Resolve the fulfilment store: customer's preferred, else the first store.
  const cust = await prisma.customer.findUnique({ where: { id: sess.customerId }, select: { preferredStoreId: true } })
  let storeId = b.storeId as string | undefined
  if (!storeId && cust?.preferredStoreId) storeId = cust.preferredStoreId
  if (!storeId) storeId = (await prisma.laundryStore.findFirst({ where: { laundryBusinessId: biz.id }, select: { id: true } }))?.id
  if (!storeId) return NextResponse.json({ error: "No store available to accept this order" }, { status: 409 })

  // Delegate to the FROZEN order-creation handler (auto-applies subscription).
  const payload = {
    businessId: biz.id, storeId, customerId: sess.customerId,
    orderType: b.orderType || "HOME_PICKUP",
    orderSource: "ONLINE_APP", // informational — the workflow is identical

    items: b.items.map((l: { serviceId: string; garmentId: string; quantity?: number; weightKg?: number }) => ({ serviceId: l.serviceId, garmentId: l.garmentId, quantity: l.quantity || 1, ...(l.weightKg ? { weightKg: l.weightKg } : {}) })),
    isExpress: !!b.isExpress,
    pickupDate: b.pickupDate || null, pickupTimeSlot: b.pickupTimeSlot || null, pickupAddress: b.pickupAddress || null, pickupInstructions: b.pickupInstructions || null,
    specialInstructions: b.specialInstructions || null, createdBy: "customer-app",
  }
  // The customer is already authenticated (app session) — delegate to the
  // frozen order handler as a trusted internal call so its staff RBAC guard is
  // bypassed for this customer-initiated order.
  const res = await createOrder(new Request("http://internal/api/laundry/orders", { method: "POST", headers: { "Content-Type": "application/json", [INTERNAL_HEADER]: INTERNAL_TOKEN }, body: JSON.stringify(payload) }))
  const j = await res.json()
  if (!res.ok || !j.success) return NextResponse.json({ error: j.error || "Failed to place order" }, { status: res.status })
  return NextResponse.json({ success: true, data: { id: j.data.id, orderNumber: j.data.orderNumber, status: j.data.status, grandTotal: j.data.grandTotal, balanceDue: j.data.balanceDue, subscriptionCoveredAmount: j.data.subscriptionCoveredAmount }, subscription: j.subscription || null }, { status: 201 })
}
