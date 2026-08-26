/**
 * Migrate VASTRASUDHA's legacy Store and Processing Center codes from the
 * retired LaundryBusiness code (LND-202608-0002) to the canonical Business
 * Code (BUS-202608-0008).
 *
 * Scope — what IS migrated:
 *   LaundryStore.storeCode
 *   LaundryProcessingCenter.centerCode
 *   LaundryOrder.orderNumber
 *   LaundryOrderItem.itemNumber + barcode  (barcode = denormalized copy of itemNumber)
 *   LaundryPacket.packetNumber + qrValue   (qrValue = denormalized copy of packetNumber)
 *   LaundryDeletedOrderLog.orderNumber
 *   LaundryPickupBag.orderNumber
 *   LaundryProcessingPackage.orderNumber
 *   LaundryBag.currentOrderNumber
 *   LaundryBagAssignment.orderNumber
 *   LaundryBagRelease.orderNumber
 *   LaundryBagEvent.orderNumber
 *
 * Scope — what is NOT touched:
 *   All primary keys (cuid) and foreign-key references
 *   Bag IDs (bagNumber, qrValue — V8BAG001, etc.)
 *   Bag sequence (TenantEmployeeSequence for BAG namespace)
 *   Employee IDs (V8EMP001, etc.)
 *   Delivery Executive IDs (V8DL001, etc.)
 *   Customer codes (CUS-BUS-202608-0008-…)
 *   Invoice / Receipt / Payment numbers (INV-LND-…, RCT-LND-…, PAY-LND-…)
 *   Transport Batch numbers (TB-BUS-…)
 *   GAR scan codes (GAR000000000001, etc.)
 *   Pickup Bag codes (PB-YYYYMM-…)
 *   Processing Package codes (PKG-YYYYMM-…)
 *   TenantEmployeeSequence counters
 *   LaundryScalingLimit or any other configuration
 *
 * Properties:
 *   - Idempotent (REPLACE is a no-op when old string is already absent)
 *   - Single transaction (all-or-nothing)
 *   - Scoped to LND-202608-0002 only (no other tenant affected)
 *
 * Usage:
 *   npx tsx scripts/migrate-vastrasudha-store-codes.ts              # dry-run (safe default)
 *   npx tsx scripts/migrate-vastrasudha-store-codes.ts --execute   # LIVE migration
 *
 * The script defaults to dry-run / read-only.  Pass --execute to write.
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const EXECUTE = process.argv.includes("--execute")
const DRY_RUN = !EXECUTE

// ── The two strings being swapped ────────────────────────────────────────────
const OLD_BIZ = "LND-202608-0002"
const NEW_BIZ = "BUS-202608-0008"

// ── Helpers ──────────────────────────────────────────────────────────────────
async function count(sql: string): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = await prisma.$queryRawUnsafe<any[]>(sql)
  return Number(rows[0]?.count ?? 0)
}

interface SampleRow {
  field: string
  table: string
  before: string
  after: string
}

async function sampleRows(sql: string, limit = 3): Promise<SampleRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = await prisma.$queryRawUnsafe<any[]>(sql)
  return rows.slice(0, limit).map((r) => ({
    field: r.field as string,
    table: r.table as string,
    before: r.before as string,
    after: r.after as string,
  }))
}

interface Summary {
  stores: number
  processingCenters: number
  orders: number
  items: number
  barcodes: number
  packets: number
  deletedOrderLogs: number
  pickupBags: number
  processingPackages: number
  bags: number
  bagAssignments: number
  bagReleases: number
  bagEvents: number
}

// ── Phase 1: Audit ───────────────────────────────────────────────────────────
async function audit(): Promise<Summary> {
  const s = {} as Summary

  s.stores            = await count(`SELECT COUNT(*) as count FROM "LaundryStore"            WHERE "storeCode"          LIKE '%${OLD_BIZ}%'`)
  s.processingCenters = await count(`SELECT COUNT(*) as count FROM "LaundryProcessingCenter"  WHERE "centerCode"         LIKE '%${OLD_BIZ}%'`)
  s.orders            = await count(`SELECT COUNT(*) as count FROM "LaundryOrder"             WHERE "orderNumber"        LIKE '%${OLD_BIZ}%'`)
  s.items             = await count(`SELECT COUNT(*) as count FROM "LaundryOrderItem"         WHERE "itemNumber"         LIKE '%${OLD_BIZ}%'`)
  s.barcodes          = await count(`SELECT COUNT(*) as count FROM "LaundryOrderItem"         WHERE "barcode"            LIKE '%${OLD_BIZ}%'`)
  s.packets           = await count(`SELECT COUNT(*) as count FROM "LaundryPacket"            WHERE "packetNumber"       LIKE '%${OLD_BIZ}%'`)
  s.deletedOrderLogs  = await count(`SELECT COUNT(*) as count FROM "LaundryDeletedOrderLog"   WHERE "orderNumber"        LIKE '%${OLD_BIZ}%'`)
  s.pickupBags        = await count(`SELECT COUNT(*) as count FROM "LaundryPickupBag"         WHERE "orderNumber"        LIKE '%${OLD_BIZ}%'`)
  s.processingPackages= await count(`SELECT COUNT(*) as count FROM "LaundryProcessingPackage" WHERE "orderNumber"        LIKE '%${OLD_BIZ}%'`)
  s.bags              = await count(`SELECT COUNT(*) as count FROM "LaundryBag"               WHERE "currentOrderNumber" LIKE '%${OLD_BIZ}%'`)
  s.bagAssignments    = await count(`SELECT COUNT(*) as count FROM "LaundryBagAssignment"     WHERE "orderNumber"        LIKE '%${OLD_BIZ}%'`)
  s.bagReleases       = await count(`SELECT COUNT(*) as count FROM "LaundryBagRelease"        WHERE "orderNumber"        LIKE '%${OLD_BIZ}%'`)
  s.bagEvents         = await count(`SELECT COUNT(*) as count FROM "LaundryBagEvent"          WHERE "orderNumber"        LIKE '%${OLD_BIZ}%'`)

  return s
}

// ── Phase 1b: Sample before → after ──────────────────────────────────────────
async function samples(): Promise<SampleRow[]> {
  const queries = [
    // Stores
    `SELECT 'storeCode' as field, 'LaundryStore' as table,
            "storeCode" as before,
            REPLACE("storeCode", '${OLD_BIZ}', '${NEW_BIZ}') as after
     FROM "LaundryStore" WHERE "storeCode" LIKE '%${OLD_BIZ}%' LIMIT 3`,

    // Processing Centers
    `SELECT 'centerCode' as field, 'LaundryProcessingCenter' as table,
            "centerCode" as before,
            REPLACE("centerCode", '${OLD_BIZ}', '${NEW_BIZ}') as after
     FROM "LaundryProcessingCenter" WHERE "centerCode" LIKE '%${OLD_BIZ}%' LIMIT 3`,

    // Orders
    `SELECT 'orderNumber' as field, 'LaundryOrder' as table,
            "orderNumber" as before,
            REPLACE("orderNumber", '${OLD_BIZ}', '${NEW_BIZ}') as after
     FROM "LaundryOrder" WHERE "orderNumber" LIKE '%${OLD_BIZ}%' LIMIT 3`,

    // Items
    `SELECT 'itemNumber' as field, 'LaundryOrderItem' as table,
            "itemNumber" as before,
            REPLACE("itemNumber", '${OLD_BIZ}', '${NEW_BIZ}') as after
     FROM "LaundryOrderItem" WHERE "itemNumber" LIKE '%${OLD_BIZ}%' LIMIT 3`,

    // Barcodes (confirm they are denormalized copies of itemNumber)
    `SELECT 'barcode' as field, 'LaundryOrderItem' as table,
            "barcode" as before,
            REPLACE("barcode", '${OLD_BIZ}', '${NEW_BIZ}') as after
     FROM "LaundryOrderItem" WHERE "barcode" LIKE '%${OLD_BIZ}%' LIMIT 3`,

    // Packets
    `SELECT 'packetNumber' as field, 'LaundryPacket' as table,
            "packetNumber" as before,
            REPLACE("packetNumber", '${OLD_BIZ}', '${NEW_BIZ}') as after
     FROM "LaundryPacket" WHERE "packetNumber" LIKE '%${OLD_BIZ}%' LIMIT 3`,
  ]

  const all: SampleRow[] = []
  for (const q of queries) all.push(...(await sampleRows(q, 3)))
  return all
}

// ── Phase 2: Migrate ─────────────────────────────────────────────────────────
// Single transaction. If any UPDATE fails, everything rolls back.
async function migrate(): Promise<Summary> {
  return prisma.$transaction(async (tx) => {
    const s = {} as Summary

    // 1. Store codes
    s.stores = Number(await tx.$executeRawUnsafe(
      `UPDATE "LaundryStore"
         SET "storeCode" = REPLACE("storeCode", '${OLD_BIZ}', '${NEW_BIZ}')
       WHERE "storeCode" LIKE '%${OLD_BIZ}%'`
    ))

    // 2. Processing center codes
    s.processingCenters = Number(await tx.$executeRawUnsafe(
      `UPDATE "LaundryProcessingCenter"
         SET "centerCode" = REPLACE("centerCode", '${OLD_BIZ}', '${NEW_BIZ}')
       WHERE "centerCode" LIKE '%${OLD_BIZ}%'`
    ))

    // 3. Order numbers
    s.orders = Number(await tx.$executeRawUnsafe(
      `UPDATE "LaundryOrder"
         SET "orderNumber" = REPLACE("orderNumber", '${OLD_BIZ}', '${NEW_BIZ}')
       WHERE "orderNumber" LIKE '%${OLD_BIZ}%'`
    ))

    // 4. Item numbers + barcode
    //    barcode = denormalized copy of itemNumber (schema comment: "barcode value = itemNumber")
    //    Must migrate both to stay in sync.
    s.items = Number(await tx.$executeRawUnsafe(
      `UPDATE "LaundryOrderItem"
         SET "itemNumber" = REPLACE("itemNumber", '${OLD_BIZ}', '${NEW_BIZ}'),
             "barcode"    = REPLACE("barcode",    '${OLD_BIZ}', '${NEW_BIZ}')
       WHERE "itemNumber" LIKE '%${OLD_BIZ}%'`
    ))
    s.barcodes = Number(await tx.$executeRawUnsafe(
      `UPDATE "LaundryOrderItem"
         SET "barcode" = REPLACE("barcode", '${OLD_BIZ}', '${NEW_BIZ}')
       WHERE "barcode" LIKE '%${OLD_BIZ}%'`
    ))

    // 5. Packet numbers + qrValue
    //    qrValue = denormalized copy of packetNumber
    s.packets = Number(await tx.$executeRawUnsafe(
      `UPDATE "LaundryPacket"
         SET "packetNumber" = REPLACE("packetNumber", '${OLD_BIZ}', '${NEW_BIZ}'),
             "qrValue"      = REPLACE("qrValue",      '${OLD_BIZ}', '${NEW_BIZ}')
       WHERE "packetNumber" LIKE '%${OLD_BIZ}%'`
    ))

    // 6. Deleted order log
    s.deletedOrderLogs = Number(await tx.$executeRawUnsafe(
      `UPDATE "LaundryDeletedOrderLog"
         SET "orderNumber" = REPLACE("orderNumber", '${OLD_BIZ}', '${NEW_BIZ}')
       WHERE "orderNumber" LIKE '%${OLD_BIZ}%'`
    ))

    // 7–12. Denormalized orderNumber copies
    s.pickupBags = Number(await tx.$executeRawUnsafe(
      `UPDATE "LaundryPickupBag"
         SET "orderNumber" = REPLACE("orderNumber", '${OLD_BIZ}', '${NEW_BIZ}')
       WHERE "orderNumber" LIKE '%${OLD_BIZ}%'`
    ))
    s.processingPackages = Number(await tx.$executeRawUnsafe(
      `UPDATE "LaundryProcessingPackage"
         SET "orderNumber" = REPLACE("orderNumber", '${OLD_BIZ}', '${NEW_BIZ}')
       WHERE "orderNumber" LIKE '%${OLD_BIZ}%'`
    ))
    s.bags = Number(await tx.$executeRawUnsafe(
      `UPDATE "LaundryBag"
         SET "currentOrderNumber" = REPLACE("currentOrderNumber", '${OLD_BIZ}', '${NEW_BIZ}')
       WHERE "currentOrderNumber" LIKE '%${OLD_BIZ}%'`
    ))
    s.bagAssignments = Number(await tx.$executeRawUnsafe(
      `UPDATE "LaundryBagAssignment"
         SET "orderNumber" = REPLACE("orderNumber", '${OLD_BIZ}', '${NEW_BIZ}')
       WHERE "orderNumber" LIKE '%${OLD_BIZ}%'`
    ))
    s.bagReleases = Number(await tx.$executeRawUnsafe(
      `UPDATE "LaundryBagRelease"
         SET "orderNumber" = REPLACE("orderNumber", '${OLD_BIZ}', '${NEW_BIZ}')
       WHERE "orderNumber" LIKE '%${OLD_BIZ}%'`
    ))
    s.bagEvents = Number(await tx.$executeRawUnsafe(
      `UPDATE "LaundryBagEvent"
         SET "orderNumber" = REPLACE("orderNumber", '${OLD_BIZ}', '${NEW_BIZ}')
       WHERE "orderNumber" LIKE '%${OLD_BIZ}%'`
    ))

    return s
  }, { maxWait: 30_000, timeout: 120_000 })
}

// ── Phase 3: Verify ──────────────────────────────────────────────────────────
async function verify(): Promise<boolean> {
  const checks = [
    `SELECT COUNT(*) as count FROM "LaundryStore"              WHERE "storeCode"          LIKE '%${OLD_BIZ}%'`,
    `SELECT COUNT(*) as count FROM "LaundryProcessingCenter"   WHERE "centerCode"         LIKE '%${OLD_BIZ}%'`,
    `SELECT COUNT(*) as count FROM "LaundryOrder"              WHERE "orderNumber"        LIKE '%${OLD_BIZ}%'`,
    `SELECT COUNT(*) as count FROM "LaundryOrderItem"          WHERE "itemNumber"         LIKE '%${OLD_BIZ}%'`,
    `SELECT COUNT(*) as count FROM "LaundryOrderItem"          WHERE "barcode"            LIKE '%${OLD_BIZ}%'`,
    `SELECT COUNT(*) as count FROM "LaundryPacket"             WHERE "packetNumber"       LIKE '%${OLD_BIZ}%'`,
    `SELECT COUNT(*) as count FROM "LaundryDeletedOrderLog"    WHERE "orderNumber"        LIKE '%${OLD_BIZ}%'`,
    `SELECT COUNT(*) as count FROM "LaundryPickupBag"          WHERE "orderNumber"        LIKE '%${OLD_BIZ}%'`,
    `SELECT COUNT(*) as count FROM "LaundryProcessingPackage"  WHERE "orderNumber"        LIKE '%${OLD_BIZ}%'`,
    `SELECT COUNT(*) as count FROM "LaundryBag"                WHERE "currentOrderNumber" LIKE '%${OLD_BIZ}%'`,
    `SELECT COUNT(*) as count FROM "LaundryBagAssignment"      WHERE "orderNumber"        LIKE '%${OLD_BIZ}%'`,
    `SELECT COUNT(*) as count FROM "LaundryBagRelease"         WHERE "orderNumber"        LIKE '%${OLD_BIZ}%'`,
    `SELECT COUNT(*) as count FROM "LaundryBagEvent"           WHERE "orderNumber"        LIKE '%${OLD_BIZ}%'`,
  ]

  let total = 0
  for (const sql of checks) total += await count(sql)
  return total === 0
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`[migrate-vastrasudha-store-codes] ${EXECUTE ? "LIVE RUN" : "DRY RUN — no writes (pass --execute to apply)"}`)
  console.log(`  old code: ${OLD_BIZ}  →  new code: ${NEW_BIZ}`)
  console.log()

  // 1. Audit counts
  console.log("── affected rows ──")
  const before = await audit()
  const totalBefore = Object.values(before).reduce((a, b) => a + b, 0)
  console.table(before)
  console.log(`  total rows to migrate: ${totalBefore}`)
  console.log()

  if (totalBefore === 0) {
    console.log("nothing to migrate — all identifiers already use the canonical code.")
    await prisma.$disconnect()
    return
  }

  // 2. Before → after samples
  console.log("── before → after examples ──")
  const ex = await samples()
  if (ex.length === 0) {
    console.log("  (no samples available)")
  } else {
    console.log("  " + "─".repeat(90))
    console.log(`  ${"field".padEnd(20)} ${"table".padEnd(28)} before → after`)
    console.log("  " + "─".repeat(90))
    for (const r of ex) {
      console.log(`  ${r.field.padEnd(20)} ${r.table.padEnd(28)} ${r.before}`)
      console.log(`  ${"".padEnd(20)} ${"".padEnd(28)} ${"→ ".padEnd(4)} ${r.after}`)
    }
    console.log("  " + "─".repeat(90))
  }
  console.log()

  if (DRY_RUN) {
    console.log("── dry run: no writes performed ──")
    await prisma.$disconnect()
    return
  }

  // 3. Execute migration
  console.log("── executing migration (single transaction) ──")
  const after = await migrate()
  const totalAfter = Object.values(after).reduce((a, b) => a + b, 0)
  console.log("  rows updated:")
  console.table(after)
  console.log(`  total rows updated: ${totalAfter}`)
  console.log()

  // 4. Verify zero remnants
  console.log("── verifying zero remnants ──")
  const clean = await verify()
  if (clean) {
    console.log("  ✓ all identifiers migrated — zero old-code remnants")
  } else {
    console.error("  ✗ remnants found — some rows still contain the old code")
    process.exitCode = 1
  }

  // 5. Sequence counters
  console.log()
  console.log("── sequence counters ──")
  console.log("  no manual adjustment needed")
  console.log("  getNextSequential() scans by prefix — next creation under the new")
  console.log("  prefix will find the highest migrated number and increment.")
  console.log()
  console.log("[migrate-vastrasudha-store-codes] done")
}

main()
  .catch((e) => { console.error("[migrate-vastrasudha-store-codes] fatal:", e); process.exit(1) })
  .finally(() => prisma.$disconnect())
