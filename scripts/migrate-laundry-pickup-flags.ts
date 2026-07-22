/**
 * Migration: set pickupRequired & deliveryRequired on historical HOME_PICKUP orders.
 *
 * When the code first shipped, some order-creation paths may not have set
 * pickupRequired/deliveryRequired for HOME_PICKUP orders. A runtime fixup
 * in the GET scheduler endpoint was masking this. This one-time migration
 * repairs the data so the runtime fixup can be safely removed.
 *
 * Usage:
 *   DRY RUN (default):  npx ts-node -r tsconfig-paths/register scripts/migrate-laundry-pickup-flags.ts
 *   APPLY:              npx ts-node -r tsconfig-paths/register scripts/migrate-laundry-pickup-flags.ts --execute
 *   APPLY (alt):        DRY_RUN=false npx ts-node -r tsconfig-paths/register scripts/migrate-laundry-pickup-flags.ts
 *
 * The script will always print a summary first and will NOT apply changes
 * unless --execute is passed or DRY_RUN=false is set.
 */

import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()

async function main() {
  const isExecute = process.argv.includes("--execute") || process.env.DRY_RUN === "false"
  console.log("=".repeat(60))

  // ── Scan ───────────────────────────────────────────────────────────────────
  const totalOrders = await db.laundryOrder.count()
  const homePickupOrders = await db.laundryOrder.count({ where: { orderType: "HOME_PICKUP" } })
  const needRepair = await db.laundryOrder.count({
    where: {
      orderType: "HOME_PICKUP",
      OR: [{ pickupRequired: false }, { deliveryRequired: false }],
    },
  })
  const alreadyCorrect = homePickupOrders - needRepair
  const nonHomePickup = totalOrders - homePickupOrders

  console.log()
  console.log(`  Laundry Orders scanned     : ${totalOrders}`)
  console.log(`  Non HOME_PICKUP            : ${nonHomePickup}`)
  console.log(`  HOME_PICKUP already correct: ${alreadyCorrect}`)
  console.log(`  HOME_PICKUP needing repair : ${needRepair}`)
  console.log()
  console.log(`  Will update                : ${isExecute ? needRepair : 0}`)
  console.log()

  if (needRepair === 0) {
    console.log("  ✓ No repair needed. All HOME_PICKUP orders already have correct flags.")
    console.log()
    console.log("  The runtime fixup in pickup-scheduler/route.ts is safe to remove.")
    console.log("=".repeat(60))
    return
  }

  if (!isExecute) {
    console.log("  ⚠ DRY RUN — no changes applied.")
    console.log("  Re-run with --execute or DRY_RUN=false to apply.")
    console.log("=".repeat(60))
    return
  }

  // ── List affected orders ────────────────────────────────────────────────────
  const affected = await db.laundryOrder.findMany({
    where: {
      orderType: "HOME_PICKUP",
      OR: [{ pickupRequired: false }, { deliveryRequired: false }],
    },
    select: { id: true, orderNumber: true, businessId: true, pickupRequired: true, deliveryRequired: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  })

  console.log("  Affected orders:")
  for (const o of affected) {
    const missing: string[] = []
    if (!o.pickupRequired) missing.push("pickupRequired")
    if (!o.deliveryRequired) missing.push("deliveryRequired")
    console.log(`    ${o.orderNumber.padEnd(20)} ${o.id.padEnd(30)} missing: ${missing.join(", ")}`)
  }
  console.log()

  // ── Apply ────────────────────────────────────────────────────────────────────
  console.log("  Applying fixes…")
  let fixed = 0
  for (const o of affected) {
    const patch: { pickupRequired?: boolean; deliveryRequired?: boolean } = {}
    if (!o.pickupRequired) patch.pickupRequired = true
    if (!o.deliveryRequired) patch.deliveryRequired = true
    await db.laundryOrder.update({ where: { id: o.id }, data: patch })
    fixed++
  }

  console.log(`  ✓ Fixed ${fixed} orders.`)
  console.log()

  // ── Verify ───────────────────────────────────────────────────────────────────
  const remaining = await db.laundryOrder.count({
    where: {
      orderType: "HOME_PICKUP",
      OR: [{ pickupRequired: false }, { deliveryRequired: false }],
    },
  })
  if (remaining > 0) {
    console.error(`  ✗ WARNING: ${remaining} orders still need fixing. Re-run migration.`)
    console.log("=".repeat(60))
    process.exit(1)
  }

  console.log("  ✓ Verified: zero remaining orders with missing flags.")
  console.log("=".repeat(60))
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
