// ============================================================================
// Laundry order STATUS FORENSICS + RECONCILIATION.
//
// Two jobs, one tool:
//
//  1. TRACE one order end to end — status, both legs, garment counts and the
//     complete LaundryOrderEvent trail. Every status change in Laundry OS writes
//     an event carrying the ACTION that caused it, so the trail names the exact
//     code path that put the order where it is. This is how you find out what
//     marked an order Delivered.
//
//  2. RECONCILE orders whose status is not supported by their own workflow
//     evidence — the "Delivered with no delivery" class of row. The honest
//     status is recomputed by the same guard the APIs now use
//     (src/lib/laundry-order-state.ts), so the repair and the runtime rule can
//     never drift apart. Rows that ARE valid are never touched.
//
//   Usage:
//     npx tsx scripts/audit-order-status.ts ORD-STR-BUS-202608-0008-002-000029
//     npx tsx scripts/audit-order-status.ts --scan                     (list every invalid row)
//     npx tsx scripts/audit-order-status.ts --scan --business <lbId>   (one tenant)
//     npx tsx scripts/audit-order-status.ts --scan --apply             (repair them)
//     npx tsx scripts/audit-order-status.ts ORD-… --apply              (repair one)
//
//  --apply never deletes anything: it rewrites `status` and appends a
//  STATUS_RECONCILED event, so the original trail survives in full.
// ============================================================================
import { prisma } from "@/lib/prisma"
import { loadOrderEvidence, reconcileStatus, checkStateInvariants } from "@/lib/laundry-order-state"
import { statusLabel } from "@/lib/laundry-workflow"

const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString().replace("T", " ").slice(0, 19) : "—")

async function trace(orderNumber: string) {
  const order = await prisma.laundryOrder.findFirst({
    where: { orderNumber },
    select: {
      id: true, orderNumber: true, businessId: true, status: true, orderType: true, orderSource: true,
      createdAt: true, auditedAt: true, billedAt: true,
      paymentStatus: true, amountPaid: true, balanceDue: true, grandTotal: true,
      pickupRequired: true, pickupExecutiveId: true, pickupAssignedAt: true, pickupAcceptance: true,
      pickupAcceptedAt: true, pickupStartedAt: true, pickupCompletedAt: true, fieldStatus: true,
      deliveryRequired: true, deliveryExecutiveId: true, deliveryAssignedAt: true, deliveryAcceptance: true,
      deliveryAcceptedAt: true, deliveryStartedAt: true, deliveryCompletedAt: true,
      deliveredAt: true, deliveredBy: true, recipientName: true,
      items: { select: { itemNumber: true, garmentName: true, inspectedAt: true, processingStage: true, processingStatus: true } },
    },
  })
  if (!order) {
    console.log(`Order ${orderNumber} not found.`)
    return null
  }

  console.log(`\n═══ ${order.orderNumber} ═══`)
  console.log(`  id            ${order.id}`)
  console.log(`  business      ${order.businessId}`)
  console.log(`  STATUS        ${order.status}  (${statusLabel(order.status)})`)
  console.log(`  type/source   ${order.orderType} / ${order.orderSource}`)
  console.log(`  created       ${iso(order.createdAt)}   audited ${iso(order.auditedAt)}   billed ${iso(order.billedAt)}`)
  console.log(`  money         total ₹${order.grandTotal}  paid ₹${order.amountPaid}  balance ₹${order.balanceDue}  (${order.paymentStatus})`)

  console.log(`\n  ── Pickup leg ${order.pickupRequired ? "" : "(not required)"}`)
  console.log(`     executive ${order.pickupExecutiveId ?? "—"}  acceptance ${order.pickupAcceptance ?? "—"}  fieldStatus ${order.fieldStatus ?? "—"}`)
  console.log(`     assigned ${iso(order.pickupAssignedAt)}  accepted ${iso(order.pickupAcceptedAt)}  started ${iso(order.pickupStartedAt)}  completed ${iso(order.pickupCompletedAt)}`)

  console.log(`\n  ── Delivery leg ${order.deliveryRequired ? "" : "(not required)"}`)
  console.log(`     executive ${order.deliveryExecutiveId ?? "—"}  acceptance ${order.deliveryAcceptance ?? "—"}`)
  console.log(`     assigned ${iso(order.deliveryAssignedAt)}  accepted ${iso(order.deliveryAcceptedAt)}  started ${iso(order.deliveryStartedAt)}  completed ${iso(order.deliveryCompletedAt)}`)
  console.log(`     deliveredAt ${iso(order.deliveredAt)}  by ${order.deliveredBy ?? "—"}  recipient ${order.recipientName ?? "—"}`)

  const inspected = order.items.filter((i) => i.inspectedAt).length
  const processed = order.items.filter((i) => (i.processingStage === "DISPATCHED" || i.processingStage === "PACKED") && i.processingStatus === "DONE").length
  console.log(`\n  ── Garments: ${order.items.length} total · ${inspected} inspected · ${processed} processing-complete`)
  for (const it of order.items.slice(0, 30)) {
    console.log(`     ${it.itemNumber ?? "—"}  ${it.garmentName}  inspected=${it.inspectedAt ? "yes" : "NO"}  stage=${it.processingStage ?? "—"}/${it.processingStatus ?? "—"}`)
  }

  const events = await prisma.laundryOrderEvent.findMany({
    where: { orderId: order.id },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true, fromStatus: true, toStatus: true, action: true, actorName: true, note: true },
  })
  console.log(`\n  ── Timeline (${events.length} events) — the ACTION column names the code path`)
  for (const e of events) {
    const move = e.fromStatus && e.fromStatus !== e.toStatus ? `${e.fromStatus} → ${e.toStatus}` : `(${e.toStatus})`
    console.log(`     ${iso(e.createdAt)}  ${e.action.padEnd(26)} ${move.padEnd(46)} ${e.actorName ?? "—"}`)
    if (e.note) console.log(`         ${e.note}`)
  }

  const ev = await loadOrderEvidence(order.id)
  if (!ev) return null
  const verdict = checkStateInvariants(ev.status, ev)
  console.log(`\n  ── Verdict`)
  if (verdict.ok) {
    console.log(`     VALID — ${statusLabel(ev.status)} is supported by the order's evidence.`)
  } else {
    const fix = reconcileStatus(ev)
    console.log(`     INVALID — ${verdict.code}: ${verdict.error}`)
    if (fix) console.log(`     Reconciles to: ${fix.from} → ${fix.to} (${statusLabel(fix.to)})`)
  }
  return ev
}

async function applyFix(orderId: string) {
  const ev = await loadOrderEvidence(orderId)
  if (!ev) return null
  const fix = reconcileStatus(ev)
  if (!fix) return null
  const moved = await prisma.laundryOrder.updateMany({
    where: { id: ev.id, status: fix.from as never },
    data: { status: fix.to as never },
  })
  if (!moved.count) return null
  await prisma.laundryOrderEvent
    .create({
      data: {
        orderId: ev.id, businessId: ev.businessId,
        fromStatus: fix.from, toStatus: fix.to,
        action: "STATUS_RECONCILED", actorName: "System Reconciliation",
        note: `Status did not match the workflow evidence and was recomputed from it — ${fix.reason}`,
      },
    })
    .catch(() => null)
  return fix
}

async function scan(businessId?: string) {
  const orders = await prisma.laundryOrder.findMany({
    where: {
      ...(businessId ? { businessId } : {}),
      status: { notIn: ["DRAFT", "CANCELLED"] },
    },
    select: { id: true, orderNumber: true, businessId: true, status: true },
    orderBy: { createdAt: "desc" },
  })
  const bad: { id: string; orderNumber: string; from: string; to: string; reason: string }[] = []
  for (const o of orders) {
    const ev = await loadOrderEvidence(o.id)
    if (!ev) continue
    const fix = reconcileStatus(ev)
    if (fix) bad.push({ id: o.id, orderNumber: o.orderNumber, ...fix })
  }
  console.log(`\nScanned ${orders.length} order(s). ${bad.length} carry a status their workflow evidence does not support.\n`)
  for (const b of bad) {
    console.log(`  ${b.orderNumber}   ${b.from} → ${b.to}`)
    console.log(`      ${b.reason}`)
  }
  return bad
}

async function main() {
  const args = process.argv.slice(2)
  const apply = args.includes("--apply")
  const doScan = args.includes("--scan")
  const bizIdx = args.indexOf("--business")
  const businessId = bizIdx >= 0 ? args[bizIdx + 1] : undefined
  const orderNumbers = args.filter((a) => !a.startsWith("--") && a !== businessId)

  if (!doScan && orderNumbers.length === 0) {
    console.log("Usage: npx tsx scripts/audit-order-status.ts <ORDER_NUMBER…> | --scan [--business <lbId>] [--apply]")
    return
  }

  if (doScan) {
    const bad = await scan(businessId)
    if (!bad.length) return
    if (!apply) {
      console.log(`\nDry run — re-run with --apply to reconcile these ${bad.length} order(s).`)
      return
    }
    let fixed = 0
    for (const b of bad) {
      const r = await applyFix(b.id)
      if (r) { fixed++; console.log(`  reconciled ${b.orderNumber}: ${r.from} → ${r.to}`) }
    }
    console.log(`\nReconciled ${fixed} order(s).`)
    return
  }

  for (const n of orderNumbers) {
    const ev = await trace(n)
    if (apply && ev) {
      const r = await applyFix(ev.id)
      console.log(r ? `\n  APPLIED: ${r.from} → ${r.to}` : `\n  Nothing to apply.`)
    }
  }
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
