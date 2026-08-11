// PATCH / DELETE a single audited garment.
//
// Store Audit exists to record what was ACTUALLY received, so an auditor has to
// be able to correct a line — swap the garment, move it to another service, fix
// a quantity or weight, or drop it entirely.
//
// Money is the delicate part, and the rule is firm:
//   • the order's snapshot (subtotal / gstTotal / grandTotal / balanceDue) is
//     recomputed from the CURRENT items through resolveOrderBilling — the same
//     engine the booking and the add-garment path use, never a second copy;
//   • LaundryPayment rows are NEVER touched. A correction on a paid order leaves
//     the payment exactly as it was and simply moves the balance, which is what
//     Payments & Ledger already renders as a balance or a refund due.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { resolveOrderBilling } from "@/lib/laundry-billing-server"

export const runtime = "nodejs"

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100

async function loadOrder(orderId: string) {
  return prisma.laundryOrder.findUnique({
    where: { id: orderId },
    select: { id: true, businessId: true, storeId: true, customerType: true, amountPaid: true, billedAt: true, status: true },
  })
}

/**
 * Re-price every remaining item and rewrite the order snapshot.
 *
 * Recomputed from scratch rather than adjusted by a delta: a delta drifts as
 * soon as one line is edited twice, and the whole point of an audit correction
 * is that lines get edited repeatedly.
 */
async function recomputeOrder(orderId: string) {
  const order = await loadOrder(orderId)
  if (!order) return null
  const items = await prisma.laundryOrderItem.findMany({
    where: { orderId },
    select: { id: true, serviceId: true, garmentId: true, quantity: true, weightKg: true },
  })

  const { lines } = await resolveOrderBilling(
    order.businessId,
    { storeId: order.storeId, customerType: order.customerType || null, pickup: false, delivery: false },
    items.map((it) => ({ serviceId: it.serviceId || null, garmentId: it.garmentId || null, quantity: it.quantity || 0, weightKg: it.weightKg || 0 })),
  )

  // PER_KG bills by the garment's own weight once weighed — identical to the
  // add-garment path, so a corrected line prices the same way a new one does.
  const priced = lines.map((l) => {
    if (l.pricingType === "PER_KG" && (l.weightKg || 0) > 0) {
      const lineAmount = r2(l.unitPrice * l.weightKg)
      const gstAmount = r2((lineAmount * (l.gstPercent || 0)) / 100)
      return { ...l, lineAmount, gstAmount, total: r2(lineAmount + gstAmount) }
    }
    return l
  })

  const subtotal = r2(priced.reduce((s, l) => s + l.lineAmount, 0))
  const gstTotal = r2(priced.reduce((s, l) => s + l.gstAmount, 0))
  const grandTotal = r2(subtotal + gstTotal)
  const totalWeightKg = r2(priced.filter((l) => l.pricingType === "PER_KG").reduce((s, l) => s + (l.weightKg || 0), 0))

  await prisma.$transaction(async (tx) => {
    // Write each line's resolved price back onto its item.
    for (let i = 0; i < items.length; i++) {
      const l = priced[i]
      if (!l) continue
      await tx.laundryOrderItem.update({
        where: { id: items[i].id },
        data: {
          serviceName: l.serviceName, garmentName: l.garmentName, categoryId: l.categoryId,
          pricingRuleId: l.pricingRuleId, pricingType: l.pricingType, unitPrice: l.unitPrice,
          lineAmount: l.lineAmount, gstPercent: l.gstPercent, gstAmount: l.gstAmount, total: l.total,
        },
      })
    }
    await tx.laundryOrder.update({
      where: { id: orderId },
      data: {
        subtotal, gstTotal, grandTotal, totalWeightKg,
        // amountPaid is NOT touched. The balance moves; the payment does not.
        balanceDue: r2(Math.max(0, grandTotal - (order.amountPaid || 0))),
      },
    })
  })

  return { grandTotal, amountPaid: order.amountPaid || 0, balanceDue: r2(Math.max(0, grandTotal - (order.amountPaid || 0))) }
}

/**
 * Records the correction on the EXISTING order timeline — no new model.
 *
 * toStatus is the order's CURRENT status: a correction is not a transition, and
 * writing anything else would make the timeline look like the order moved.
 */
async function logEvent(order: { id: string; businessId: string; status: string }, action: string, note: string, actorName?: string | null) {
  try {
    await prisma.laundryOrderEvent.create({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { orderId: order.id, businessId: order.businessId, toStatus: order.status as any, action, note, actorName: actorName || null },
    })
  } catch { /* the timeline is diagnostic; never block a correction on it */ }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  try {
    const { id, itemId } = await params
    const b = await request.json().catch(() => ({}))
    const order = await loadOrder(id)
    if (!order) return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 })
    const guard = await requireLaundryPermission(request, order.businessId, "store_ops.store_audit.edit")
    if (!guard.ok) return guard.res

    const item = await prisma.laundryOrderItem.findFirst({ where: { id: itemId, orderId: id } })
    if (!item) return NextResponse.json({ success: false, error: "Item not found" }, { status: 404 })

    const serviceId = b.serviceId ?? item.serviceId
    const garmentId = b.garmentId ?? item.garmentId
    const quantity = b.quantity !== undefined ? Math.max(1, Math.round(Number(b.quantity) || 1)) : item.quantity
    const weightKg = b.weightKg !== undefined ? Math.max(0, Number(b.weightKg) || 0) : item.weightKg

    // The service must exist AND still be active — a retired service cannot be
    // the destination of a correction.
    if (serviceId !== item.serviceId) {
      const svc = await prisma.laundryService.findFirst({ where: { id: serviceId ?? "", businessId: order.businessId, isActive: true }, select: { id: true } })
      if (!svc) return NextResponse.json({ success: false, error: "That service is not available." }, { status: 400 })
    }
    if (garmentId !== item.garmentId) {
      const grm = await prisma.laundryGarment.findFirst({ where: { id: garmentId ?? "", businessId: order.businessId, isActive: true }, select: { id: true } })
      if (!grm) return NextResponse.json({ success: false, error: "That garment is not available." }, { status: 400 })
    }

    // NA combinations are refused BEFORE anything is written: the resolver
    // returns no priced line when the garment×service pair has no rule.
    const probe = await resolveOrderBilling(
      order.businessId,
      { storeId: order.storeId, customerType: order.customerType || null, pickup: false, delivery: false },
      [{ serviceId: serviceId || null, garmentId: garmentId || null, quantity, weightKg }],
    )
    const line = probe.lines[0]
    if (!line || !line.pricingRuleId) {
      const [g, s] = await Promise.all([
        prisma.laundryGarment.findUnique({ where: { id: garmentId ?? "" }, select: { name: true } }),
        prisma.laundryService.findUnique({ where: { id: serviceId ?? "" }, select: { name: true } }),
      ])
      return NextResponse.json({ success: false, error: `${g?.name || "This garment"} is not available for ${s?.name || "this service"}.` }, { status: 400 })
    }

    const before = `${item.garmentName} · ${item.serviceName} · qty ${item.quantity}${item.weightKg ? ` · ${item.weightKg}kg` : ""}`
    await prisma.laundryOrderItem.update({
      where: { id: itemId },
      data: { serviceId, garmentId, quantity, weightKg, serviceName: line.serviceName, garmentName: line.garmentName },
    })
    const totals = await recomputeOrder(id)
    const after = `${line.garmentName} · ${line.serviceName} · qty ${quantity}${weightKg ? ` · ${weightKg}kg` : ""}`
    await logEvent(order, "AUDIT_ITEM_CHANGED", `${before} → ${after}`, guard.ctx?.userName)

    return NextResponse.json({ success: true, data: { itemId, ...totals } })
  } catch (e) {
    console.error("[audit-item] PATCH", e)
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  try {
    const { id, itemId } = await params
    const businessId = new URL(request.url).searchParams.get("businessId")
    const order = await loadOrder(id)
    if (!order) return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 })
    const guard = await requireLaundryPermission(request, businessId || order.businessId, "store_ops.store_audit.edit")
    if (!guard.ok) return guard.res

    const item = await prisma.laundryOrderItem.findFirst({ where: { id: itemId, orderId: id } })
    if (!item) return NextResponse.json({ success: false, error: "Item not found" }, { status: 404 })

    await prisma.laundryOrderItem.delete({ where: { id: itemId } })
    const totals = await recomputeOrder(id)
    await logEvent(order, "AUDIT_ITEM_REMOVED", `${item.garmentName} · ${item.serviceName} removed`, guard.ctx?.userName)

    return NextResponse.json({ success: true, data: totals })
  } catch (e) {
    console.error("[audit-item] DELETE", e)
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 })
  }
}
