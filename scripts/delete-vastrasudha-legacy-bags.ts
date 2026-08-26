/**
 * Delete VASTRASUDHA's test bags (BAG-000001, BAG-000002) and reset the
 * BAG sequence so next generated bags start at V8BAG001.
 *
 * Scope: VASTRASUDHA only (LaundryBusiness.id = lb_vs).
 *
 * What is deleted:
 *   - LaundryBag records matching BAG-NNNNNN
 *   - LaundryBagEvent rows (movement log) for those bags
 *   - LaundryBagRelease rows (audit) for those bags
 *   - LaundryBagAssignment rows (should be 0 — verified in dry-run)
 *   - Denormalized bag-number references in LaundryOrder.deliveryBagNumber
 *   - Denormalized bag-number references in LaundryProcessingPackage.bagCode/qrValue
 *
 * What is NOT touched:
 *   - Employee IDs (EMP), Delivery IDs (DL), Customer, Order, Item, Store, Processing Center IDs
 *   - Any other namespace in TenantEmployeeSequence
 *   - Any other tenant/business
 *   - Bag primary keys (FKs — all removed via cascade)
 *
 * After deletion:
 *   TenantEmployeeSequence BAG counter is reset to next=1,
 *   so the first new bag created via UI will be V8BAG001.
 *
 * Properties:
 *   - Defaults to dry-run.  Pass --execute to delete.
 *
 * Usage:
 *   npx tsx scripts/delete-vastrasudha-legacy-bags.ts            # dry-run
 *   npx tsx scripts/delete-vastrasudha-legacy-bags.ts --execute  # live
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const EXECUTE = process.argv.includes("--execute")
const DRY_RUN = !EXECUTE

const LAUNDRY_BIZ_ID = "lb_vs"
const LEGACY_BAG = /^BAG-\d+$/i

async function main() {
  console.log(`[delete-vastrasudha-legacy-bags] ${EXECUTE ? "LIVE RUN" : "DRY RUN — no deletes (pass --execute to apply)"}`)
  console.log()

  const bags = await prisma.laundryBag.findMany({
    where: { businessId: LAUNDRY_BIZ_ID },
    orderBy: { createdAt: "asc" },
  })

  const legacy = bags.filter((b) => LEGACY_BAG.test(b.bagNumber))
  const other  = bags.filter((b) => !LEGACY_BAG.test(b.bagNumber))

  console.log(`  bags total:     ${bags.length}`)
  console.log(`  legacy (BAG-*): ${legacy.length}`)
  console.log(`  already V8BAG*: ${other.length}`)
  console.log()

  if (legacy.length === 0) {
    console.log("  Nothing to delete.")
    await prisma.$disconnect()
    return
  }

  let blocked = false
  console.log("  ── bag detail ──")
  for (const b of legacy) {
    const hasOrder   = !!b.currentOrderId
    const hasRelease = !!b.releasedAt
    const flag = hasOrder ? " ⚠ ACTIVE ORDER" : hasRelease ? " (released)" : ""
    console.log(`  ${b.bagNumber}  id=${b.id}  status=${b.status}${flag}`)
    if (hasOrder) blocked = true
  }
  console.log()

  if (blocked) {
    console.error("  ✗ Cannot delete: one or more bags have an active order.")
    console.error("    Release them first via the Bag Management UI.")
    await prisma.$disconnect()
    process.exit(1)
  }

  // Count orphaned rows that will be cleaned up
  const bagIds = legacy.map((b) => b.id)
  const bagNums = legacy.map((b) => b.bagNumber)
  const events  = await prisma.laundryBagEvent.count({ where: { bagId: { in: bagIds } } })
  const releases = await prisma.laundryBagRelease.count({ where: { bagId: { in: bagIds } } })
  const asgCount = await prisma.laundryBagAssignment.count({ where: { bagId: { in: bagIds } } })
  const deliveryRefs = await prisma.laundryOrder.count({ where: { businessId: LAUNDRY_BIZ_ID, deliveryBagNumber: { in: bagNums } } })
  const pkgBagCodeRefs = await prisma.laundryProcessingPackage.count({ where: { businessId: LAUNDRY_BIZ_ID, bagCode: { in: bagNums } } })
  const pkgQrRefs = await prisma.laundryProcessingPackage.count({ where: { businessId: LAUNDRY_BIZ_ID, qrValue: { in: bagNums } } })

  // Sequence counter
  const seqRow = await prisma.tenantEmployeeSequence.findUnique({
    where: { businessId_namespace: { businessId: "biz_vastrasudha", namespace: "BAG" } },
    select: { id: true, next: true },
  })

  console.log("  ── cascade cleanup ──")
  console.log(`  LaundryBagEvent:              ${events}`)
  console.log(`  LaundryBagRelease:            ${releases}`)
  console.log(`  LaundryBagAssignment:         ${asgCount}`)
  console.log(`  deliveryBagNumber refs:       ${deliveryRefs}`)
  console.log(`  processingPackage bagCode:    ${pkgBagCodeRefs}`)
  console.log(`  processingPackage qrValue:    ${pkgQrRefs}`)
  console.log()
  console.log("  ── sequence reset ──")
  console.log(`  BAG namespace counter:        next=${seqRow?.next ?? "(none)"} → 1`)
  console.log()
  console.log("  NOT affected:")
  console.log("    Employee IDs (V8EMP*)           0 changes")
  console.log("    Delivery IDs (V8DL*)            0 changes")
  console.log("    Customer IDs                    0 changes")
  console.log("    Order IDs                       0 changes")
  console.log("    Item IDs                        0 changes")
  console.log("    Store IDs                       0 changes")
  console.log("    Processing Center IDs           0 changes")
  console.log("    EMP / DL / COM namespaces       0 changes")
  console.log("    Other tenants                   0 changes")
  console.log()

  if (DRY_RUN) {
    console.log("── dry run: no deletes performed ──")
    await prisma.$disconnect()
    return
  }

  // Delete in transaction: audit rows first, then bags, then denormalized refs, then reset sequence
  await prisma.$transaction(async (tx) => {
    // 1. Events (child)
    await tx.laundryBagEvent.deleteMany({ where: { bagId: { in: bagIds } } })
    // 2. Releases (child)
    await tx.laundryBagRelease.deleteMany({ where: { bagId: { in: bagIds } } })
    // 3. Assignments (should be 0, but safe)
    await tx.laundryBagAssignment.deleteMany({ where: { bagId: { in: bagIds } } })
    // 4. Bags themselves
    const deleted = await tx.laundryBag.deleteMany({ where: { id: { in: bagIds } } })
    console.log(`  deleted ${deleted.count} bag(s)`)

    // 5. Denormalized bag-number in LaundryOrder — VASTRASUDHA orders only
    if (bagNums.length > 0) {
      // Find VASTRASUDHA orders whose deliveryBagNumber matches a deleted bag.
      // LaundryOrder.businessId = LaundryBusiness.id = lb_vs
      const vsOrders = await tx.laundryOrder.findMany({
        where: { businessId: LAUNDRY_BIZ_ID, deliveryBagNumber: { in: bagNums } },
        select: { id: true, deliveryBagNumber: true },
      })
      for (const o of vsOrders) {
        await tx.laundryOrder.update({
          where: { id: o.id },
          data: { deliveryBagNumber: null },
        })
      }
      console.log(`  cleared ${vsOrders.length} VASTRASUDHA deliveryBagNumber ref(s)`)
    }

    // 6. Denormalized bag-number in LaundryProcessingPackage — VASTRASUDHA only
    //    ProcessingPackage.businessId = LaundryBusiness.id = lb_vs
    if (bagNums.length > 0) {
      const vsPkgs = await tx.laundryProcessingPackage.findMany({
        where: { businessId: LAUNDRY_BIZ_ID, bagCode: { in: bagNums } },
        select: { id: true, bagCode: true, qrValue: true },
      })
      for (const p of vsPkgs) {
        const data: { bagCode?: string | null; qrValue?: string } = {}
        if (p.bagCode && bagNums.includes(p.bagCode)) data.bagCode = null
        if (p.qrValue && bagNums.includes(p.qrValue)) data.qrValue = ""
        if (Object.keys(data).length > 0) {
          await tx.laundryProcessingPackage.update({ where: { id: p.id }, data })
        }
      }
      console.log(`  cleared ${vsPkgs.length} VASTRASUDHA processingPackage ref(s)`)
    }

    // 7. Reset BAG sequence to 1
    if (seqRow) {
      await tx.tenantEmployeeSequence.update({
        where: { id: seqRow.id },
        data: { next: 1 },
      })
      console.log(`  reset BAG sequence: next=${seqRow.next} → 1`)
    } else {
      await tx.tenantEmployeeSequence.create({
        data: { businessId: "biz_vastrasudha", namespace: "BAG", next: 1 },
      })
      console.log("  created BAG sequence: next=1")
    }
  })

  // Verify
  const after = await prisma.laundryBag.findMany({
    where: { businessId: LAUNDRY_BIZ_ID },
  })
  const seqAfter = await prisma.tenantEmployeeSequence.findUnique({
    where: { businessId_namespace: { businessId: "biz_vastrasudha", namespace: "BAG" } },
    select: { next: true },
  })
  console.log()
  console.log(`  remaining bags: ${after.length}`)
  for (const b of after) console.log(`    ${b.bagNumber}`)
  console.log(`  BAG sequence next: ${seqAfter?.next}`)
  console.log()
  console.log("  ✓ Done. Next bag created via UI will be V8BAG001.")
}

main()
  .catch((e) => { console.error("[delete-vastrasudha-legacy-bags] fatal:", e); process.exit(1) })
  .finally(() => prisma.$disconnect())
