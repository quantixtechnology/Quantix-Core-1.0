import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()

async function validate() {
  console.log("=".repeat(60))
  console.log("LAUNDRY WORKSPACE — VALIDATION REPORT")
  console.log("=".repeat(60))

  // 1. Check workspaceType distribution
  const workspaceCounts = await db.$queryRawUnsafe<Array<{ workspaceType: string; count: bigint }>>(
    `SELECT workspaceType, COUNT(*) as count FROM Business GROUP BY workspaceType`
  )
  console.log("\n📊 WorkspaceType Distribution:")
  for (const row of workspaceCounts) {
    console.log(`  ${row.workspaceType}: ${row.count}`)
  }

  // 2. Check for NULL workspaceType
  const nullWorkspace = await db.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*) as count FROM Business WHERE workspaceType IS NULL`
  )
  console.log(`\n❌ NULL workspaceType: ${nullWorkspace[0]?.count || 0}`)

  // 3. Check StoreType distribution
  const storeTypeCounts = await db.$queryRawUnsafe<Array<{ storeType: string; count: bigint }>>(
    `SELECT storeType, COUNT(*) as count FROM Store GROUP BY storeType`
  )
  console.log("\n🏪 StoreType Distribution:")
  for (const row of storeTypeCounts) {
    console.log(`  ${row.storeType}: ${row.count}`)
  }

  // 4. Laundry businesses
  const laundryBizs = await db.$queryRawUnsafe<Array<{ id: string; name: string; workspaceType: string; businessCategory: string }>>(
    `SELECT id, name, workspaceType, businessCategory FROM Business WHERE workspaceType = 'LAUNDRY'`
  )
  console.log(`\n🧺 Laundry Businesses: ${laundryBizs.length}`)
  for (const biz of laundryBizs) {
    console.log(`  ${biz.name} (${biz.id}) — Category: ${biz.businessCategory}`)
    const storeCount = await db.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*) as count FROM Store WHERE businessId = '${biz.id}'`
    )
    console.log(`    Stores: ${storeCount[0]?.count || 0}`)
    const orderCount = await db.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*) as count FROM "Order" WHERE businessId = '${biz.id}'`
    )
    console.log(`    Orders: ${orderCount[0]?.count || 0}`)
  }

  // 5. Ecommerce businesses (verify no regression)
  const ecomBizs = await db.$queryRawUnsafe<Array<{ id: string; name: string; workspaceType: string }>>(
    `SELECT id, name, workspaceType FROM Business WHERE workspaceType = 'ECOMMERCE' LIMIT 5`
  )
  console.log(`\n🛒 Ecommerce Businesses (sample): ${ecomBizs.length}`)
  for (const biz of ecomBizs) {
    console.log(`  ${biz.name} — workspaceType: ${biz.workspaceType}`)
  }

  // 6. Total data counts
  const totalBusinesses = await db.business.count()
  const totalStores = await db.store.count()
  const totalOrders = await db.order.count()
  const totalGarments = await db.garmentItem.count()
  console.log(`\n📈 Total Counts:`)
  console.log(`  Businesses: ${totalBusinesses}`)
  console.log(`  Stores: ${totalStores}`)
  console.log(`  Orders: ${totalOrders}`)
  console.log(`  Garment Items: ${totalGarments}`)

  console.log("\n" + "=".repeat(60))
  console.log("VALIDATION COMPLETE")
  console.log("=".repeat(60))
}

validate()
  .catch((e) => {
    console.error("Validation failed:", e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
