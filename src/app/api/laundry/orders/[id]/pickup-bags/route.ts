// Pickup Bags for an order — one bag per booked service (Pickup-First).
// GET  — list this order's bags.
// POST — generate bags (one per service line), idempotent. QR at pickup; no
//        garments/pricing/invoice here. Additive; reuses the order's services.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { generatePickupBagCode } from "@/lib/laundry-codes"

export const runtime = "nodejs"

async function loadOrderBiz(id: string) {
  return prisma.laundryOrder.findUnique({ where: { id }, select: { id: true, businessId: true, orderNumber: true, customerId: true, pickupDate: true, services: { select: { serviceId: true, serviceName: true } } } })
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const order = await prisma.laundryOrder.findUnique({ where: { id }, select: { businessId: true } })
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })
    const guard = await requireLaundryPermission(request, order.businessId, "laundry.orders.view")
    if (!guard.ok) return guard.res
    const bags = await prisma.laundryPickupBag.findMany({ where: { orderId: id }, orderBy: { createdAt: "asc" } })
    return NextResponse.json({ success: true, data: bags })
  } catch (e) {
    console.error("[pickup-bags] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const b = await request.json().catch(() => ({}))
    const order = await loadOrderBiz(id)
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })
    const guard = await requireLaundryPermission(request, order.businessId, "laundry.orders.create")
    if (!guard.ok) return guard.res

    // Idempotent — never generate a second set of bags for the same order.
    const existing = await prisma.laundryPickupBag.findMany({ where: { orderId: id }, orderBy: { createdAt: "asc" } })
    if (existing.length > 0) return NextResponse.json({ success: true, data: existing, alreadyGenerated: true })

    const customer = order.customerId ? await prisma.customer.findUnique({ where: { id: order.customerId }, select: { name: true } }) : null
    const services = order.services.length ? order.services : [{ serviceId: null, serviceName: "Laundry" }]

    const created: Awaited<ReturnType<typeof prisma.laundryPickupBag.create>>[] = []
    for (const s of services) {
      const code = await generatePickupBagCode()
      const bag = await prisma.laundryPickupBag.create({
        data: {
          code, qrValue: code, businessId: order.businessId, orderId: order.id, orderNumber: order.orderNumber,
          serviceId: s.serviceId || null, serviceName: s.serviceName,
          customerId: order.customerId || null, customerName: customer?.name || null,
          pickupDate: order.pickupDate || null, pickupExecutive: b.actorName || null, status: "COLLECTED",
        },
      })
      created.push(bag)
    }
    return NextResponse.json({ success: true, data: created }, { status: 201 })
  } catch (e) {
    console.error("[pickup-bags] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
