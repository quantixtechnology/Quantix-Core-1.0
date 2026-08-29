/**
 * READ-ONLY audit of bag custody consistency.
 *
 * `status` (can it be used?) and `custodian` (who holds it?) are two halves of
 * one physical fact. Until the custody fix, only the delivery-side paths wrote
 * both, so a bag could read as current in two places at once. This lists every
 * bag whose stored custodian disagrees with the holder its status implies.
 *
 * It WRITES NOTHING. Repair is a separate, explicit decision per record — a mass
 * update would overwrite genuine exceptions (a bag lost at the store, a damaged
 * one held by the executive who found it) with a guess.
 *
 *   npx tsx scripts/audit-bag-custody.ts            # every business
 *   npx tsx scripts/audit-bag-custody.ts <bizId>    # one business
 */
import { prisma } from "../src/lib/prisma"
import { custodianForStatus, BAG_STATUS } from "../src/lib/laundry-bag-lifecycle"

// Statuses where a difference is legitimate rather than a defect: these are
// records of an exception, not movements, so the holder is deliberately the
// place the bag was last seen.
const EXPLAINED = new Set<string>([BAG_STATUS.LOST, BAG_STATUS.DAMAGED, BAG_STATUS.RETIRED, BAG_STATUS.INSPECTION_REQUIRED])

async function main() {
  const businessId = process.argv[2]
  const bags = await prisma.laundryBag.findMany({
    where: businessId ? { businessId } : {},
    select: {
      id: true, bagNumber: true, businessId: true, status: true,
      currentCustodianType: true, currentOrderNumber: true, currentCustomerName: true,
      updatedAt: true,
    },
    orderBy: [{ businessId: "asc" }, { bagNumber: "asc" }],
  })

  const mismatched = bags.filter((b) => b.currentCustodianType !== custodianForStatus(b.status))
  const defects = mismatched.filter((b) => !EXPLAINED.has(b.status))
  const explained = mismatched.filter((b) => EXPLAINED.has(b.status))

  console.log(`Bags:            ${bags.length}`)
  console.log(`Consistent:      ${bags.length - mismatched.length}`)
  console.log(`Explained:       ${explained.length}   (exception states — holder is where it was last seen)`)
  console.log(`Inconsistent:    ${defects.length}\n`)

  if (defects.length) {
    console.log("BAG          STATUS                STORED HOLDER         IMPLIED HOLDER        ORDER")
    console.log("-".repeat(110))
    for (const b of defects) {
      console.log(
        b.bagNumber.padEnd(12) +
        b.status.padEnd(22) +
        (b.currentCustodianType || "—").padEnd(22) +
        custodianForStatus(b.status).padEnd(22) +
        (b.currentOrderNumber || "—")
      )
    }
    console.log("\nNothing was changed. Each row is a separate decision: confirm where the")
    console.log("bag physically is before correcting it, and prefer letting the next real")
    console.log("scan write the correct state now that the writers set both halves.")
  }
  await prisma.$disconnect()
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
