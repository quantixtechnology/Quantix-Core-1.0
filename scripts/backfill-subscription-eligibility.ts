// ============================================================================
// Backfill: migrate per-plan subscription coverage → Pricing Matrix eligibility.
//
// Subscription eligibility is now owned solely by the Pricing Matrix
// (LaundryGarment.subscriptionIncluded). This one-time, idempotent backfill marks
// every garment that existing per-plan SubscriptionPlanCoverage rules referenced
// as subscriptionIncluded, so no existing plan intent is lost after the switch.
//   · rule with a garmentId      → flag that garment
//   · rule with garmentId = null → flag every garment priced in that service
//   npx tsx scripts/backfill-subscription-eligibility.ts
// ============================================================================
import { prisma } from "@/lib/prisma"

async function main() {
  const rules = await prisma.subscriptionPlanCoverage.findMany({ select: { serviceId: true, garmentId: true } })
  if (rules.length === 0) { console.log("No per-plan coverage rules — nothing to backfill."); await prisma.$disconnect(); return }

  const garmentIds = new Set<string>()
  for (const r of rules) if (r.garmentId) garmentIds.add(r.garmentId)

  // "All garments in service" rules → every garment that has a pricing rule there.
  const allServiceIds = [...new Set(rules.filter((r) => !r.garmentId).map((r) => r.serviceId))]
  if (allServiceIds.length > 0) {
    const priced = await prisma.laundryPricingRule.findMany({ where: { serviceId: { in: allServiceIds }, garmentId: { not: null } }, select: { garmentId: true } })
    for (const p of priced) if (p.garmentId) garmentIds.add(p.garmentId)
  }

  const ids = [...garmentIds]
  if (ids.length === 0) { console.log("No garments referenced by coverage rules."); await prisma.$disconnect(); return }
  const res = await prisma.laundryGarment.updateMany({ where: { id: { in: ids } }, data: { subscriptionIncluded: true } })
  console.log(`Flagged subscriptionIncluded=true for ${res.count} garment(s) (from ${rules.length} coverage rule(s)).`)
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
