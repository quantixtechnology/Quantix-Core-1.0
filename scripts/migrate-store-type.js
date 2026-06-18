#!/usr/bin/env node
// =============================================================================
// MIGRATE STORE TYPE — One-time migration for StoreType enum change
//
// Old enum: STANDARD | PROCESSING_CENTER | PICKUP_STORE
// New enum: PICKUP_CENTER | PROCESSING_CENTER | BOTH
//
// Mapping:
//   STANDARD       -> PICKUP_CENTER   (general-purpose → customer-facing pickup)
//   PICKUP_STORE   -> PICKUP_CENTER   (old pickup → new pickup)
//   PROCESSING_CENTER -> PROCESSING_CENTER (unchanged)
//   MAIN           -> PICKUP_CENTER   (legacy value → pickup)
//   BRANCH         -> PICKUP_CENTER   (legacy value → pickup)
// =============================================================================

const { PrismaClient } = require("@prisma/client")

const db = new PrismaClient()

const OLD_TO_NEW_MAP = {
  STANDARD: "PICKUP_CENTER",
  PICKUP_STORE: "PICKUP_CENTER",
  PROCESSING_CENTER: "PROCESSING_CENTER",
  MAIN: "PICKUP_CENTER",
  BRANCH: "PICKUP_CENTER",
  PICKUP_CENTER: "PICKUP_CENTER",
  BOTH: "BOTH",
}

async function migrate() {
  console.log("=".repeat(60))
  console.log("STORETYPE MIGRATION")
  console.log("=".repeat(60))

  // 1. Find all distinct storeType values in the database
  const raw = await db.$queryRawUnsafe(
    `SELECT DISTINCT storeType FROM Store`
  )
  const existingTypes = raw.map(r => r.storeType).filter(Boolean)
  console.log("\n📋 Existing storeType values in database:")
  for (const t of existingTypes) {
    console.log(`  "${t}"`)
  }

  // 2. Find stores with old/invalid types
  const invalidTypes = existingTypes.filter(t => !["PICKUP_CENTER", "PROCESSING_CENTER", "BOTH"].includes(t))
  if (invalidTypes.length === 0) {
    console.log("\n✅ No invalid storeType values found. Migration not needed.")
    await db.$disconnect()
    return
  }

  console.log(`\n⚠️  Found ${invalidTypes.length} invalid storeType value(s): ${invalidTypes.join(", ")}`)

  // 3. Count stores per old type
  for (const oldType of invalidTypes) {
    const count = await db.$queryRawUnsafe(
      `SELECT COUNT(*) as count FROM Store WHERE storeType = '${oldType}'`
    )
    const newType = OLD_TO_NEW_MAP[oldType] || "PICKUP_CENTER"
    console.log(`  "${oldType}" → "${newType}": ${count[0]?.count || 0} store(s)`)
  }

  // 4. Perform the migration
  console.log("\n🔄 Migrating store types...")
  for (const oldType of invalidTypes) {
    const newType = OLD_TO_NEW_MAP[oldType] || "PICKUP_CENTER"
    await db.$executeRawUnsafe(
      `UPDATE Store SET storeType = '${newType}' WHERE storeType = '${oldType}'`
    )
    console.log(`  Updated "${oldType}" → "${newType}"`)
  }

  // 5. Verify
  const remainingRaw = await db.$queryRawUnsafe(
    `SELECT storeType, COUNT(*) as count FROM Store GROUP BY storeType`
  )
  console.log("\n✅ After migration:")
  for (const row of remainingRaw) {
    const valid = ["PICKUP_CENTER", "PROCESSING_CENTER", "BOTH"].includes(row.storeType)
    console.log(`  ${valid ? "✓" : "✗"} "${row.storeType}": ${row.count}`)
  }

  // 6. Check for any remaining invalid values
  const invalidRemaining = remainingRaw.filter(
    r => !["PICKUP_CENTER", "PROCESSING_CENTER", "BOTH"].includes(r.storeType)
  )
  if (invalidRemaining.length > 0) {
    console.log(`\n❌ ${invalidRemaining.length} invalid value(s) remain! Manual fix required.`)
    process.exit(1)
  }

  console.log("\n✅ Migration complete!")
}

migrate()
  .catch((e) => {
    console.error("Migration failed:", e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
