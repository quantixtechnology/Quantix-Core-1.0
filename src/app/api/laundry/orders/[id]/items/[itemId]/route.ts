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
import { applySubscriptionToOrder } from "@/lib/laundry-subscription-server"
import { explodePieces } from "@/lib/laundry-order-items"
import { nextGarScanCode, healGarSequenceCounter } from "@/lib/laundry-codes"

export const runtime = "nodejs"

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100

async function loadOrder(orderId: string) {
  return prisma.laundryOrder.findUnique({
    where: { id: orderId },
    select: { id: true, businessId: true, orderNumber: true, storeId: true, customerType: true, amountPaid: true, billedAt: true, status: true },
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

  // PER_KG is billed by the ORDER's total weight, not per line — computeQuote
  // groups those lines and prices them from ctx.totalWeightKg. Omitting it (as
  // this did) resolves the rule correctly, reports the right ₹/kg, and then
  // amounts every per-kg line at ZERO. That is why an audited Blanket moved to
  // Dry Clean showed the new service at no charge.
  const totalWeightKg = r2(items.reduce((n, it) => n + (it.weightKg || 0), 0))

  const { lines } = await resolveOrderBilling(
    order.businessId,
    { storeId: order.storeId, customerType: order.customerType || null, pickup: false, delivery: false, totalWeightKg },
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

  // SUBSCRIPTION FOLLOWS THE AUDITED LINE.
  //
  // Coverage is decided per garment×service from the order's CURRENT items, but
  // it is applied ONCE and then treated as settled. After an audit correction
  // that snapshot is stale: a Blanket booked as Wash & Fold (covered) and
  // audited as Dry Clean (not covered) kept the coverage it no longer qualifies
  // for, and kept consuming the customer's allowance.
  //
  // force releases the existing consumption and re-applies against the audited
  // lines, so eligible lines stay covered, ineligible ones become payable, and
  // the allowance reflects only what actually qualified. Real payments are
  // untouched — this moves the coverage portion, not a LaundryPayment row.
  //
  // Only when coverage was already applied: an order that never used a
  // subscription is left to the normal flow rather than silently acquiring one.
  const beforeCoverage = await prisma.laundryOrder.findUnique({ where: { id: orderId }, select: { subscriptionCoveredAmount: true } })
  if ((beforeCoverage?.subscriptionCoveredAmount || 0) > 0) {
    try {
      await applySubscriptionToOrder(orderId, { force: true, actorName: "Store Audit correction" })
    } catch (e) {
      // Never leave the order un-priced because the subscription re-apply failed.
      console.error("[audit-item] subscription re-apply", e)
    }
  }

  const after = await prisma.laundryOrder.findUnique({
    where: { id: orderId },
    select: { grandTotal: true, amountPaid: true, balanceDue: true, subscriptionCoveredAmount: true },
  })
  // A per-kg garment with no weight cannot be priced. Say so explicitly — a
  // silent ₹0 is indistinguishable from "free" and is what made this look like
  // a pricing failure rather than a missing measurement.
  const needsWeight = items
    .map((it, i) => ({ it, l: priced[i] }))
    .filter(({ it, l }) => l && l.pricingType === "PER_KG" && (it.weightKg || 0) <= 0)
    .map(({ it, l }) => ({ itemId: it.id, garmentName: l.garmentName, serviceName: l.serviceName, unitPrice: l.unitPrice }))

  return {
    needsWeight,
    totalWeightKg,
    grandTotal: r2(after?.grandTotal ?? grandTotal),
    amountPaid: r2(after?.amountPaid ?? order.amountPaid ?? 0),
    balanceDue: r2(after?.balanceDue ?? 0),
    subscriptionCoveredAmount: r2(after?.subscriptionCoveredAmount ?? 0),
  }
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
      { storeId: order.storeId, customerType: order.customerType || null, pickup: false, delivery: false, totalWeightKg: weightKg },
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

    // ── PER-GARMENT IDENTITY ────────────────────────────────────────────
    //
    // "5 × Shirt" is FIVE physical garments, not one row carrying a 5. Barcode
    // Generation, processing, QC and delivery all operate on individual
    // LaundryOrderItem records, so every write path normalises through
    // explodePieces — createLaundryOrder does, the intake/add-garment endpoint
    // does. THIS one did not: it wrote the quantity straight onto the single
    // row, so an audited "5 shirts" reached Barcode Generation as one garment
    // with one barcode, and five physical shirts shared one lifecycle.
    const units = explodePieces([{ ...line, quantity, weightKg }])

    // A garment that already carries its own operational identity cannot be
    // split behind itself — its barcode is printed and its siblings were never
    // in the processing queue. Say so instead of silently corrupting the order.
    if (units.length > 1 && (item.barcodeGenerated || item.processingStage)) {
      return NextResponse.json({
        success: false,
        error: `${item.garmentName} has already been barcoded, so its quantity cannot be changed here. Add the extra garments as their own lines instead.`,
      }, { status: 409 })
    }

    // GAR codes are minted serially — the counter is atomic but not safe to
    // race — and healed first so a drifted counter cannot re-issue an existing
    // code and P2002 the whole correction.
    const extra = units.slice(1)
    const garCodes: string[] = []
    if (extra.length > 0) {
      await healGarSequenceCounter()
      for (let i = 0; i < extra.length; i++) garCodes.push(await nextGarScanCode())
    }

    const before = `${item.garmentName} · ${item.serviceName} · qty ${item.quantity}${item.weightKg ? ` · ${item.weightKg}kg` : ""}`
    await prisma.$transaction(async (tx) => {
      const head = units[0]
      await tx.laundryOrderItem.update({
        where: { id: itemId },
        // The edited row KEEPS its id, its GAR code and its history — it becomes
        // garment 1 of N rather than being replaced, so nothing already scanned
        // or inspected loses its identity.
        data: { serviceId, garmentId, quantity: head.quantity, weightKg: head.weightKg, serviceName: line.serviceName, garmentName: line.garmentName },
      })
      if (extra.length === 0) return
      const base = await tx.laundryOrderItem.count({ where: { orderId: id } })
      for (let i = 0; i < extra.length; i++) {
        const u = extra[i]
        const gar = garCodes[i]
        await tx.laundryOrderItem.create({
          data: {
            orderId: id,
            itemNumber: `ITM-${order.orderNumber}-${String(base + i + 1).padStart(4, "0")}`,
            barcode: gar, garmentScanCode: gar,
            serviceId, serviceName: line.serviceName,
            garmentId, garmentName: line.garmentName,
            categoryId: line.categoryId, pricingRuleId: line.pricingRuleId, pricingType: line.pricingType,
            quantity: u.quantity, weightKg: u.weightKg ?? 0,
            unitPrice: line.unitPrice, lineAmount: u.lineAmount,
            gstPercent: line.gstPercent, gstAmount: u.gstAmount,
            discount: u.discount ?? 0, total: u.total,
            // Saying "this line is 5 garments" does not un-inspect what the
            // auditor already inspected — the siblings carry the same verdict,
            // so the audit gate is not silently reset by a correction.
            condition: item.condition, defects: item.defects,
            inspectionNotes: item.inspectionNotes, inspectedAt: item.inspectedAt,
          },
        })
      }
    })

    // Prices every item from scratch, so the split lines are re-priced
    // individually and the order total is unchanged by the normalisation.
    const totals = await recomputeOrder(id)
    const after = `${line.garmentName} · ${line.serviceName} · qty ${quantity}${weightKg ? ` · ${weightKg}kg` : ""}`
    await logEvent(
      order,
      "AUDIT_ITEM_CHANGED",
      extra.length > 0
        ? `${before} → ${after} (recorded as ${units.length} individual garments)`
        : `${before} → ${after}`,
      guard.ctx?.userName,
    )

    return NextResponse.json({ success: true, data: { itemId, split: units.length, ...totals } })
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
