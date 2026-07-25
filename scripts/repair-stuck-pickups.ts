// Repair legacy stuck pickups — a one-time, idempotent data heal.
//
// Before the chain-of-custody refactor, an executive completing a pickup set
// fieldStatus=PICKUP_COMPLETED + pickupCompletedAt (and the bag → COLLECTED) but
// never advanced LaundryOrder.status, leaving orders stranded at
// AWAITING_PICKUP_ASSIGNMENT. Those rows show contradictory state across modules
// (Orders: Awaiting, Assign Bags: Pickup Complete, Bag: Collected, Dispatch: hidden).
//
// This advances every such order to IN_TRANSIT_TO_STORE — the correct post-pickup,
// pre-store-receipt state — so status becomes the single source of truth again and
// the order reappears in Dispatch as "Pending Receipt". It records a repair event so
// the heal is auditable. Safe to run repeatedly (only touches stranded rows).
//
//   Usage:  npx tsx scripts/repair-stuck-pickups.ts        (dry run — lists only)
//           npx tsx scripts/repair-stuck-pickups.ts --apply (performs the heal)
import { prisma } from "@/lib/prisma"

async function main() {
  const apply = process.argv.includes("--apply")
  const stuck = await prisma.laundryOrder.findMany({
    where: {
      status: "AWAITING_PICKUP_ASSIGNMENT",
      pickupRequired: true,
      pickupCompletedAt: { not: null },
    },
    select: { id: true, orderNumber: true, businessId: true, pickupCompletedAt: true, pickupExecutiveId: true },
  })

  console.log(`Found ${stuck.length} stuck pickup order(s) (AWAITING_PICKUP_ASSIGNMENT + pickup completed).`)
  for (const o of stuck) console.log(`  • ${o.orderNumber}  picked up ${o.pickupCompletedAt?.toISOString()}`)

  if (!stuck.length) return
  if (!apply) {
    console.log("\nDry run — re-run with --apply to advance these to IN_TRANSIT_TO_STORE.")
    return
  }

  let healed = 0
  for (const o of stuck) {
    // Guarded update: only advance if still AWAITING (idempotent under concurrency).
    const res = await prisma.laundryOrder.updateMany({
      where: { id: o.id, status: "AWAITING_PICKUP_ASSIGNMENT" },
      data: { status: "IN_TRANSIT_TO_STORE" },
    })
    if (res.count) {
      await prisma.laundryOrderEvent.create({
        data: {
          businessId: o.businessId,
          orderId: o.id,
          fromStatus: "AWAITING_PICKUP_ASSIGNMENT",
          toStatus: "IN_TRANSIT_TO_STORE",
          action: "PICKUP_COMPLETED",
          actorName: "System (custody repair)",
          note: "Legacy pickup completed before chain-of-custody refactor — status advanced to In Transit to Store so it is receivable at the store.",
        },
      }).catch((e) => console.warn(`  ! event log failed for ${o.orderNumber}:`, e?.message))
      healed++
      console.log(`  ✓ ${o.orderNumber} → IN_TRANSIT_TO_STORE`)
    }
  }
  console.log(`\nHealed ${healed} order(s).`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
