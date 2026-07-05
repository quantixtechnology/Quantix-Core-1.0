#!/usr/bin/env node
// One-time: deactivate legacy generic CHARGE rules in the Laundry workspace so
// they can no longer affect billing (charges are now the two config cards).
// A charge rule = garment-agnostic (garmentId null) AND no base price (price 0)
// AND carries a charge field. Base-price rules (garment price, PER_KG service
// price) are NOT touched. Commerce is unaffected (different model). Idempotent.
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
async function main() {
  const candidates = await prisma.laundryPricingRule.findMany({
    where: { isActive: true, garmentId: null, price: 0 },
    select: { id: true, name: true, minCharge: true, pickupCharge: true, deliveryCharge: true, expressCharge: true, weekendPrice: true, freeDeliveryThreshold: true, urgentDeliveryCharge: true },
  })
  const charge = candidates.filter((r) => [r.minCharge, r.pickupCharge, r.deliveryCharge, r.expressCharge, r.weekendPrice, r.freeDeliveryThreshold, r.urgentDeliveryCharge].some((v) => v != null && v > 0))
  console.log(`Found ${charge.length} legacy charge rule(s) to deactivate.`)
  for (const r of charge) console.log(`  - ${r.name || r.id}`)
  if (charge.length) {
    const res = await prisma.laundryPricingRule.updateMany({ where: { id: { in: charge.map((r) => r.id) } }, data: { isActive: false, status: 'INACTIVE' } })
    console.log(`Deactivated ${res.count}.`)
  }
}
main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
