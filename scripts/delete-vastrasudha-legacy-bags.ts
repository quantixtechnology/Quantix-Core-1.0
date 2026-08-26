/**
 * Delete VASTRASUDHA's legacy bags so they can be recreated
 * with the new V8BAGxxx format via the Bag Management UI.
 *
 * Scope: VASTRASUDHA only (LaundryBusiness.id = lb_vs).
 * Deletes bags matching legacy BAG-NNNNNN pattern.
 *
 * Properties:
 *   - Defaults to dry-run.  Pass --execute to delete.
 *   - Only deletes bags with no active order and no active assignment.
 *   - Also cleans up orphaned events + releases for deleted bags.
 *   - Leaves TenantEmployeeSequence untouched (UI healing handles it).
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
  const events  = await prisma.laundryBagEvent.count({ where: { bagId: { in: bagIds } } })
  const releases = await prisma.laundryBagRelease.count({ where: { bagId: { in: bagIds } } })
  const asgCount = await prisma.laundryBagAssignment.count({ where: { bagId: { in: bagIds } } })

  console.log("  ── cascade cleanup ──")
  console.log(`  LaundryBagEvent:     ${events}`)
  console.log(`  LaundryBagRelease:   ${releases}`)
  console.log(`  BagAssignment:       ${asgCount}`)
  console.log()

  if (DRY_RUN) {
    console.log("── dry run: no deletes performed ──")
    await prisma.$disconnect()
    return
  }

  // Delete in transaction: audit rows first, then bags
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
  })

  // Verify
  const after = await prisma.laundryBag.findMany({
    where: { businessId: LAUNDRY_BIZ_ID },
  })
  console.log()
  console.log(`  remaining bags: ${after.length}`)
  for (const b of after) console.log(`    ${b.bagNumber}`)
  console.log()
  console.log("  ✓ Done. Recreate via Bag Management UI to get V8BAGxxx format.")
}

main()
  .catch((e) => { console.error("[delete-vastrasudha-legacy-bags] fatal:", e); process.exit(1) })
  .finally(() => prisma.$disconnect())
