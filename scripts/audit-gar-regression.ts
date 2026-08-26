// READ-ONLY audit: GAR barcode regression check for all tenants.
// Usage: npx tsx scripts/audit-gar-regression.ts
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const tenants = await prisma.laundryBusiness.findMany({
    select: { id: true, businessName: true, businessCode: true },
  })

  console.log(`\n${"=".repeat(70)}`)
  console.log(`GAR BARCODE REGRESSION AUDIT — ${new Date().toISOString()}`)
  console.log(`${"=".repeat(70)}`)

  for (const biz of tenants) {
    const businessId = biz.id
    console.log(`\n${"-".repeat(70)}`)
    console.log(`TENANT: ${biz.businessName} (${biz.businessCode || "no-code"})`)
    console.log(`ID: ${businessId}`)
    console.log(`${"-".repeat(70)}`)

    const totalItems = await prisma.laundryOrderItem.count({
      where: { order: { businessId } },
    })

    const withGar = await prisma.laundryOrderItem.count({
      where: { order: { businessId }, garmentScanCode: { not: null } },
    })

    const withoutGar = await prisma.laundryOrderItem.count({
      where: { order: { businessId }, garmentScanCode: null },
    })

    const withItmBarcode = await prisma.laundryOrderItem.count({
      where: { order: { businessId }, barcode: { startsWith: "ITM-" } },
    })

    const withGarBarcode = await prisma.laundryOrderItem.count({
      where: { order: { businessId }, barcode: { startsWith: "GAR" } },
    })

    const barcodeGeneratedNoGar = await prisma.laundryOrderItem.count({
      where: { order: { businessId }, barcodeGenerated: true, garmentScanCode: null },
    })

    // Duplicate GAR check
    const garItems = await prisma.laundryOrderItem.findMany({
      where: { order: { businessId }, garmentScanCode: { not: null } },
      select: { garmentScanCode: true },
    })
    const garCounts = new Map<string, number>()
    for (const item of garItems) {
      if (item.garmentScanCode) {
        garCounts.set(item.garmentScanCode, (garCounts.get(item.garmentScanCode) || 0) + 1)
      }
    }
    const duplicates = [...garCounts.entries()].filter(([, count]) => count > 1)

    // Highest GAR
    const highestGar = await prisma.laundryOrderItem.findFirst({
      where: { order: { businessId }, garmentScanCode: { not: null } },
      orderBy: { garmentScanCode: "desc" },
      select: { garmentScanCode: true },
    })

    // GAR sequence counter
    const counter = await prisma.laundryGarSequenceCounter.findUnique({
      where: { id: "singleton" },
    })

    // Newest 20 items
    const newestItems = await prisma.laundryOrderItem.findMany({
      where: { order: { businessId } },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        order: { select: { orderNumber: true } },
        itemNumber: true,
        garmentScanCode: true,
        barcode: true,
        barcodeGenerated: true,
        createdAt: true,
      },
    })

    console.log(`\n  Total Order Items:     ${totalItems}`)
    console.log(`  Items WITH GAR:        ${withGar}`)
    console.log(`  Items WITHOUT GAR:     ${withoutGar}`)
    console.log(`  Items with ITM barcode: ${withItmBarcode}`)
    console.log(`  Items with GAR barcode: ${withGarBarcode}`)
    console.log(`  barcodeGenerated=true BUT GAR missing: ${barcodeGeneratedNoGar}`)
    console.log(`  Duplicate GAR values:  ${duplicates.length}`)
    if (duplicates.length > 0) {
      for (const [gar, count] of duplicates.slice(0, 5)) {
        console.log(`    ${gar} × ${count}`)
      }
    }
    console.log(`  Highest GAR:           ${highestGar?.garmentScanCode || "none"}`)
    console.log(`  GAR Sequence Counter:  ${counter ? `next=${counter.next}` : "NOT INITIALIZED"}`)

    console.log(`\n  Newest 20 items:`)
    console.log(`  ${"─".repeat(65)}`)
    console.log(`  ${"orderNumber".padEnd(30)} ${"itemNumber".padEnd(45)} GAR             barcode                         barGen  createdAt`)
    console.log(`  ${"─".repeat(65)}`)
    for (const item of newestItems) {
      const orderNum = item.order?.orderNumber || "?"
      const itm = item.itemNumber || ""
      const gar = item.garmentScanCode || "NULL"
      const bc = item.barcode || ""
      const gen = item.barcodeGenerated ? "Y" : "N"
      const date = item.createdAt.toISOString().slice(0, 16)
      console.log(`  ${orderNum.padEnd(30)} ${itm.slice(0, 44).padEnd(45)} ${gar.slice(0, 15).padEnd(16)} ${bc.slice(0, 30).padEnd(31)} ${gen.padEnd(7)} ${date}`)
    }
  }

  // Global GAR counter status
  console.log(`\n${"=".repeat(70)}`)
  console.log(`GLOBAL GAR SEQUENCE COUNTER`)
  console.log(`${"=".repeat(70)}`)
  const counter = await prisma.laundryGarSequenceCounter.findUnique({
    where: { id: "singleton" },
  })
  console.log(`  Counter: ${counter ? `next=${counter.next}` : "NOT INITIALIZED"}`)
  const globalHighest = await prisma.laundryOrderItem.findFirst({
    where: { garmentScanCode: { not: null } },
    orderBy: { garmentScanCode: "desc" },
    select: { garmentScanCode: true },
  })
  console.log(`  Highest GAR in DB: ${globalHighest?.garmentScanCode || "none"}`)
  console.log(`  Total items with GAR: ${await prisma.laundryOrderItem.count({ where: { garmentScanCode: { not: null } } })}`)
  console.log(`  Total items without GAR: ${await prisma.laundryOrderItem.count({ where: { garmentScanCode: null } })}`)

  console.log(`\n${"=".repeat(70)}`)
  console.log(`AUDIT COMPLETE — NO DATA WAS MODIFIED`)
  console.log(`${"=".repeat(70)}\n`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
