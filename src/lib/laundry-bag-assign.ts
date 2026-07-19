// Reusable-bag assignment ENGINE (shared). Extracted so both the Admin route
// (/api/laundry/bags/assign) and the Executive PWA use the exact same logic —
// one bag = one service, only an AVAILABLE bag can be assigned, the physical
// bag's permanent QR is reused (no per-order QR). No auth here; callers gate.
import { prisma } from "@/lib/prisma"

export type AssignResult =
  | { ok: true; bag: Awaited<ReturnType<typeof prisma.laundryBag.update>> }
  | { ok: false; status: number; error: string }

export async function assignBagToOrder(opts: {
  lbId: string
  code: string
  orderId: string
  serviceId?: string | null
  serviceName?: string
}): Promise<AssignResult> {
  const code = String(opts.code || "").trim()
  const orderId = String(opts.orderId || "").trim()
  if (!code || !orderId) return { ok: false, status: 400, error: "code and orderId are required" }

  const bag = await prisma.laundryBag.findFirst({ where: { businessId: opts.lbId, OR: [{ bagNumber: code }, { qrValue: code }] } })
  if (!bag) return { ok: false, status: 404, error: "Bag not found." }
  if (bag.status !== "AVAILABLE") {
    const msg = bag.status === "DAMAGED" ? "Bag marked as Damaged. Please use another bag."
      : bag.status === "LOST" ? "Bag is marked Lost."
      : bag.status === "CLEANING" ? "Bag is being cleaned. Please use another bag."
      : "Bag already assigned to another order."
    return { ok: false, status: 409, error: msg }
  }

  const order = await prisma.laundryOrder.findFirst({ where: { id: orderId, businessId: opts.lbId }, select: { id: true, orderNumber: true, customerId: true } })
  if (!order) return { ok: false, status: 404, error: "Order not found" }
  const customer = order.customerId ? await prisma.customer.findUnique({ where: { id: order.customerId }, select: { name: true } }) : null

  const serviceId = opts.serviceId ? String(opts.serviceId) : null
  const serviceName = String(opts.serviceName || "Laundry")

  // One bag = one service: block a second bag for the same order+service.
  if (serviceId) {
    const dup = await prisma.laundryBag.findFirst({ where: { businessId: opts.lbId, currentOrderId: orderId, currentServiceId: serviceId, status: { notIn: ["AVAILABLE", "RETURNED", "DELIVERED"] } } })
    if (dup) return { ok: false, status: 409, error: `${serviceName} already has bag ${dup.bagNumber} assigned.` }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const bg = await tx.laundryBag.update({
      where: { id: bag.id },
      data: {
        status: "COLLECTED",
        currentOrderId: order.id, currentOrderNumber: order.orderNumber,
        currentServiceId: serviceId, currentServiceName: serviceName,
        currentCustomerId: order.customerId || null, currentCustomerName: customer?.name || null,
        // usageCount is incremented on RELEASE (one completed reuse cycle), not
        // here — see releaseBagsForOrder().
        lastUsedAt: new Date(),
      },
    })
    await tx.laundryBagAssignment.create({
      data: { bagId: bag.id, businessId: opts.lbId, orderId: order.id, orderNumber: order.orderNumber, serviceId, serviceName, customerId: order.customerId || null, customerName: customer?.name || null, status: "ASSIGNED" },
    })
    return bg
  })
  return { ok: true, bag: updated }
}

// ── Reusable-bag lifecycle release/advance ───────────────────────────────────
// A reusable bag is a company asset — reserved ONLY while carrying an order. When
// its order is delivered, the bag is RELEASED automatically: cleared of the order
// links and returned to AVAILABLE, ready for the next pickup. History is NEVER
// lost — it lives in LaundryBagAssignment (closed as RETURNED). No manual reset.
const RELEASABLE = ["ASSIGNED", "COLLECTED", "RECEIVED_AT_STORE", "UNDER_AUDIT", "PROCESSING", "READY_FOR_DELIVERY", "DELIVERED", "RETURNED", "CLEANING"] as const

export async function releaseBagsForOrder(lbId: string, orderId: string): Promise<number> {
  const bags = await prisma.laundryBag.findMany({ where: { businessId: lbId, currentOrderId: orderId, status: { in: [...RELEASABLE] } }, select: { id: true } })
  if (!bags.length) return 0
  const now = new Date()
  await prisma.$transaction(async (tx) => {
    for (const b of bags) {
      await tx.laundryBag.update({
        where: { id: b.id },
        data: {
          status: "AVAILABLE",
          currentOrderId: null, currentOrderNumber: null, currentServiceId: null, currentServiceName: null,
          currentCustomerId: null, currentCustomerName: null,
          lastReturnedAt: now, totalUsageCount: { increment: 1 },
        },
      })
      await tx.laundryBagAssignment.updateMany({ where: { bagId: b.id, orderId, status: "ASSIGNED" }, data: { status: "RETURNED", returnedAt: now } })
    }
  })
  return bags.length
}

// Advance the bags carrying an order to a mid-lifecycle status (e.g.
// READY_FOR_DELIVERY) as the order progresses — display accuracy only. Never
// touches released/lost/damaged bags.
export async function advanceBagsForOrder(lbId: string, orderId: string, status: string): Promise<void> {
  await prisma.laundryBag.updateMany({
    where: { businessId: lbId, currentOrderId: orderId, status: { notIn: ["AVAILABLE", "LOST", "DAMAGED", "RETIRED"] } },
    data: { status },
  }).catch(() => {})
}
