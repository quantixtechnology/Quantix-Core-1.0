/**
 * Migration: set isVeg based on product category name
 *
 * Rules:
 *   category contains chicken / mutton / fish / seafood / sea food / meat
 *     → isVeg = false  (NON_VEG)
 *   everything else
 *     → isVeg = null   (NONE — no badge shown)
 *
 * Run with:
 *   npx ts-node -r tsconfig-paths/register scripts/migrate-dietary-type.ts
 */

import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()

const NON_VEG_KEYWORDS = ["chicken", "mutton", "fish", "seafood", "sea food", "meat", "prawn", "shrimp", "crab", "lobster", "lamb", "pork", "beef"]

async function main() {
  console.log("Starting dietary-type migration…")

  // 1. Fetch all products with their category name
  const products = await db.product.findMany({
    select: { id: true, name: true, isVeg: true, category: { select: { name: true } } },
  })

  console.log(`Total products: ${products.length}`)

  let setNonVeg = 0
  let setNone   = 0
  let skipped   = 0

  for (const product of products) {
    const categoryName = (product.category?.name ?? "").toLowerCase()
    const isNonVeg     = NON_VEG_KEYWORDS.some(kw => categoryName.includes(kw))
    const targetIsVeg  = isNonVeg ? false : null

    if (product.isVeg === targetIsVeg) { skipped++; continue }

    await db.product.update({
      where: { id: product.id },
      data:  { isVeg: targetIsVeg },
    })

    if (isNonVeg) setNonVeg++
    else setNone++
  }

  console.log(`✓ Set NON_VEG (isVeg=false): ${setNonVeg}`)
  console.log(`✓ Set NONE    (isVeg=null):  ${setNone}`)
  console.log(`  Unchanged:                 ${skipped}`)
  console.log("Migration complete.")
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
