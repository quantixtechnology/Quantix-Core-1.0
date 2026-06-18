import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()

const BUSINESS_TYPE_WORKSPACE_MAP: Record<string, string> = {
  GROCERY: "ECOMMERCE",
  PHARMACY: "ECOMMERCE",
  MEAT_DELIVERY: "ECOMMERCE",
  ECOMMERCE: "ECOMMERCE",
  FOOD_DELIVERY: "ECOMMERCE",
  COSMETICS: "ECOMMERCE",
  FURNITURE: "ECOMMERCE",
  DIRECTORY: "ECOMMERCE",
  LAUNDRY: "LAUNDRY",
  CAR_WASH: "CAR_WASH",
  HOME_SERVICES: "SERVICES",
}

const BUSINESS_TYPE_CATEGORY_MAP: Record<string, string> = {
  GROCERY: "Grocery",
  PHARMACY: "Pharmacy",
  MEAT_DELIVERY: "Meat Shop",
  ECOMMERCE: "General Store",
  FOOD_DELIVERY: "Restaurant",
  COSMETICS: "Cosmetics",
  FURNITURE: "Furniture",
  DIRECTORY: "General Store",
  LAUNDRY: "Laundry",
  CAR_WASH: "Car Wash",
  HOME_SERVICES: "Home Services",
}

async function migrate() {
  console.log("Starting workspaceType + businessCategory migration...")

  const businesses = await db.business.findMany({
    select: { id: true, businessType: true, workspaceType: true, businessCategory: true },
  })

  console.log(`Found ${businesses.length} businesses to check.`)

  let updated = 0
  let skipped = 0

  for (const biz of businesses) {
    const targetWorkspace = BUSINESS_TYPE_WORKSPACE_MAP[biz.businessType] || "ECOMMERCE"
    const targetCategory = BUSINESS_TYPE_CATEGORY_MAP[biz.businessType] || "General"
    const needsWorkspaceUpdate = !biz.workspaceType || biz.workspaceType !== targetWorkspace
    const needsCategoryUpdate = !biz.businessCategory || biz.businessCategory !== targetCategory

    if (needsWorkspaceUpdate || needsCategoryUpdate) {
      await db.business.update({
        where: { id: biz.id },
        data: {
          workspaceType: targetWorkspace as any,
          businessCategory: targetCategory,
        },
      })
      console.log(`  Updated ${biz.id} (${biz.businessType}) -> workspace: ${targetWorkspace}, category: ${targetCategory}`)
      updated++
    } else {
      skipped++
    }
  }

  console.log(`\nMigration complete.`)
  console.log(`  Updated: ${updated}`)
  console.log(`  Skipped: ${skipped}`)
  console.log(`  Total:   ${businesses.length}`)
}

migrate()
  .catch((e) => {
    console.error("Migration failed:", e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
