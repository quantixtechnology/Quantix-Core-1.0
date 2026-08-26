// Backfill GAR codes for all existing LaundryOrderItems that lack one.
// Uses the existing backfillGarScanCodes() from laundry-codes.ts.
// READ-ONLY audit before and after.
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("=== GAR BACKFILL ===")

  // Before
  const before = await prisma.laundryOrderItem.findMany({
    where: { garmentScanCode: null },
    select: { id: true, itemNumber: true, barcode: true },
  })
  console.log(`\nItems without GAR before: ${before.length}`)
  for (const item of before) {
    console.log(`  ${item.id} | ${item.itemNumber} | barcode=${item.barcode}`)
  }

  // Import the backfill function dynamically
  const { backfillGarScanCodes } = await import("../src/lib/laundry-codes")
  const filled = await backfillGarScanCodes()
  console.log(`\nBackfilled: ${filled} items`)

  // After
  const after = await prisma.laundryOrderItem.findMany({
    where: { garmentScanCode: null },
    select: { id: true, itemNumber: true },
  })
  console.log(`\nItems without GAR after: ${after.length}`)

  // Verify: show all items with their GAR codes
  const allItems = await prisma.laundryOrderItem.findMany({
    select: {
      id: true,
      itemNumber: true,
      garmentScanCode: true,
      barcode: true,
      order: { select: { orderNumber: true } },
    },
    orderBy: { createdAt: "asc" },
  })
  console.log(`\nAll items (${allItems.length}):`)
  for (const item of allItems) {
    console.log(`  GAR=${(item.garmentScanCode || "NULL").padEnd(20)} barcode=${(item.barcode || "NULL").padEnd(50)} item=${item.itemNumber}`)
  }

  // GAR counter status
  const counter = await prisma.laundryGarSequenceCounter.findUnique({ where: { id: "singleton" } })
  console.log(`\nGAR counter: next=${counter?.next || "NOT SET"}`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
