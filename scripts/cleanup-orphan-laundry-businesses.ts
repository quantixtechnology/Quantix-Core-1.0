/**
 * Orphan LaundryBusiness cleanup — remove records belonging to deleted businesses.
 *
 * IDENTIFICATION LOGIC
 *   A LaundryBusiness is an orphan if ANY of:
 *     1. platformBusinessId IS NULL                     (no link to any Business)
 *     2. platformBusinessId references a Business that   (Business was hard-deleted)
 *        no longer exists in the Business table
 *     3. platformBusinessId references a Business with   (Business was soft-deleted)
 *        status INACTIVE | SUSPENDED | EXPIRED | CHURNED
 *
 * PROTECTED TENANTS (never touched):
 *   Laundry & Drycleaners — id: cmr3136pv0007qkwkg2irf3tm
 *                           platformBusinessId: cmqjfpuvj0000qkjzv9i7pcae
 *
 * Usage:
 *   DRY RUN:  npx ts-node -r tsconfig-paths/register scripts/cleanup-orphan-laundry-businesses.ts
 *   APPLY:    npx ts-node -r tsconfig-paths/register scripts/cleanup-orphan-laundry-businesses.ts --execute
 *
 * The script always prints a report first and requires --execute to write.
 */

import { PrismaClient, BusinessStatus } from "@prisma/client"

const db = new PrismaClient()

// ── PROTECTED TENANTS (never delete, never touch) ──────────────────────────
const PROTECTED_LB_IDS = new Set([
  "cmr3136pv0007qkwkg2irf3tm", // Laundry & Drycleaners
])

const PROTECTED_PLATFORM_IDS = new Set([
  "cmqjfpuvj0000qkjzv9i7pcae", // Laundry & Drycleaners
])

// Active BusinessStatus values — businesses with these statuses are ACTIVE
const ACTIVE_STATUSES: BusinessStatus[] = [
  "ACTIVE",
  "TRIAL",
  "ONBOARDING",
  "PROVISIONING_FAILED",
]

interface OrphanInfo {
  lbId: string
  lbName: string
  platformBusinessId: string | null
  reason: string
  status: string
}

async function main() {
  const isExecute = process.argv.includes("--execute")
  console.log("=".repeat(70))
  console.log("  ORPHAN LAUNDRYBUSINESS CLEANUP")
  console.log("=".repeat(70))
  console.log()

  // ── Step 1: Fetch all LaundryBusinesses ─────────────────────────────────
  const allLB = await db.laundryBusiness.findMany({
    select: {
      id: true,
      businessName: true,
      platformBusinessId: true,
      status: true,
      createdAt: true,
      stores: { select: { id: true, storeName: true } },
    },
    orderBy: { createdAt: "asc" },
  })

  console.log(`  Total LaundryBusiness records: ${allLB.length}`)
  console.log()

  const orphans: OrphanInfo[] = []
  const active: string[] = []
  const warnings: string[] = []

  for (const lb of allLB) {
    // Check if protected
    if (PROTECTED_LB_IDS.has(lb.id)) {
      active.push(`${lb.businessName} (PROTECTED — active tenant)`)
      continue
    }

    if (lb.platformBusinessId && PROTECTED_PLATFORM_IDS.has(lb.platformBusinessId)) {
      active.push(`${lb.businessName} (PROTECTED — platform Business is active tenant)`)
      continue
    }

    // ── CASE 1: platformBusinessId IS NULL ──────────────────────────────
    if (!lb.platformBusinessId) {
      // Check if a Business with matching name exists (could be an unlinked active business)
      const bizByName = await db.business.findFirst({
        where: { name: lb.businessName },
        select: { id: true, status: true, productCode: true },
      })

      if (bizByName) {
        // Found a Business with matching name — check if it's active
        if (ACTIVE_STATUSES.includes(bizByName.status as BusinessStatus)) {
          // Business exists and is active, but not linked — this is a fixable situation
          warnings.push(
            `${lb.businessName} (id=${lb.id}): platformBusinessId IS NULL but active Business ` +
              `"${bizByName.id}" (status=${bizByName.status}) exists with matching name. ` +
              `This LaundryBusiness should be linked, not deleted.`
          )
          active.push(`${lb.businessName} — active Business exists, needs linking`)
          continue
        } else {
          // Business exists but is inactive/deleted — orphan
          orphans.push({
            lbId: lb.id,
            lbName: lb.businessName,
            platformBusinessId: null,
            reason: `platformBusinessId IS NULL; matching Business "${bizByName.id}" has status ${bizByName.status} (inactive)`,
            status: lb.status,
          })
          continue
        }
      } else {
        // No matching Business found at all — orphan
        orphans.push({
          lbId: lb.id,
          lbName: lb.businessName,
          platformBusinessId: null,
          reason: "platformBusinessId IS NULL and no Business found with matching name",
          status: lb.status,
        })
        continue
      }
    }

    // ── CASE 2 & 3: platformBusinessId is set — verify the Business exists ─
    const biz = await db.business.findUnique({
      where: { id: lb.platformBusinessId },
      select: { id: true, name: true, status: true, productCode: true },
    })

    if (!biz) {
      // Business was hard-deleted
      orphans.push({
        lbId: lb.id,
        lbName: lb.businessName,
        platformBusinessId: lb.platformBusinessId,
        reason: `Platform Business "${lb.platformBusinessId}" no longer exists (hard-deleted)`,
        status: lb.status,
      })
      continue
    }

    if (!ACTIVE_STATUSES.includes(biz.status as BusinessStatus)) {
      // Business exists but is inactive
      orphans.push({
        lbId: lb.id,
        lbName: lb.businessName,
        platformBusinessId: lb.platformBusinessId,
        reason: `Platform Business "${biz.id}" (${biz.name}) has status ${biz.status} (inactive/deleted)`,
        status: lb.status,
      })
      continue
    }

    // Business exists and is active
    active.push(`${lb.businessName} — linked to active Business "${biz.id}" (${biz.status})`)
  }

  // ── Report ───────────────────────────────────────────────────────────────
  console.log("  ── ACTIVE (protected / valid) ──")
  for (const a of active) {
    console.log(`    ✓ ${a}`)
  }
  console.log()

  if (warnings.length > 0) {
    console.log("  ── WARNINGS (active Business exists but not linked) ──")
    for (const w of warnings) {
      console.log(`    ⚠ ${w}`)
    }
    console.log()
  }

  console.log("  ── ORPHANS (to be deleted) ──")
  if (orphans.length === 0) {
    console.log("    (none)")
  } else {
    for (const o of orphans) {
      console.log(`    ✗ ${o.lbName} (id=${o.lbId})`)
      console.log(`      platformBusinessId: ${o.platformBusinessId || "null"}`)
      console.log(`      status: ${o.status}`)
      console.log(`      reason: ${o.reason}`)
    }
  }
  console.log()

  if (orphans.length === 0 && warnings.length === 0) {
    console.log("  ✓ No orphans found. All LaundryBusinesses are properly linked to active Businesses.")
    console.log("=".repeat(70))
    return
  }

  if (orphans.length === 0) {
    console.log("  ✓ No orphans found. Warnings above need manual review.")
    console.log("=".repeat(70))
    return
  }

  // ── Count records for deletion ───────────────────────────────────────────
  const orphanIds = orphans.map((o) => o.lbId)

  const delCounts = {
    laundryBusiness: orphanIds.length,
    stores: await db.laundryStore.count({ where: { laundryBusinessId: { in: orphanIds } } }),
    deliveryExecutives: await db.laundryDeliveryExecutive.count({
      where: { businessId: { in: orphanIds } },
    }),
    services: await db.laundryService.count({ where: { businessId: { in: orphanIds } } }),
    categories: await db.laundryCategory.count({ where: { businessId: { in: orphanIds } } }),
    garments: await db.laundryGarment.count({ where: { businessId: { in: orphanIds } } }),
    pricingRules: await db.laundryPricingRule.count({ where: { businessId: { in: orphanIds } } }),
    orders: await db.laundryOrder.count({ where: { businessId: { in: orphanIds } } }),
    customersViaLB: await db.customer.count({ where: { businessId: { in: orphanIds } } }),
    customersViaPlatform: 0,
    bags: await db.laundryBag.count({ where: { businessId: { in: orphanIds } } }),
    processingPackages: await db.laundryProcessingPackage.count({
      where: { businessId: { in: orphanIds } },
    }),
    notifications: await db.notification.count({
      where: { businessId: { in: orphanIds } },
    }),
    auditLogs: await db.laundryAuditLog.count({ where: { businessId: { in: orphanIds } } }),
    financialSettings: await db.laundryFinancialSettings.count({
      where: { businessId: { in: orphanIds } },
    }),
    branding: await db.laundryBrandingConfig.count({ where: { businessId: { in: orphanIds } } }),
    operationalConfig: await db.laundryOperationalConfig.count({
      where: { businessId: { in: orphanIds } },
    }),
    rbacAssignments: await db.laundryAccessAssignment.count({
      where: { businessId: { in: orphanIds } },
    }),
    pricingRulesAudit: await db.laundryPricingRuleAudit.count({
      where: { businessId: { in: orphanIds } },
    }),
  }

  // For customers, also check by platformBusinessId of each orphan
  for (const o of orphans) {
    if (o.platformBusinessId) {
      const c = await db.customer.count({ where: { businessId: o.platformBusinessId } })
      delCounts.customersViaPlatform += c
    }
  }

  const total = Object.values(delCounts).reduce((a, b) => a + b, 0)

  console.log("  ── RECORDS TO DELETE ──")
  const labelWidth = 30
  console.log(`  ${"LaundryBusiness".padEnd(labelWidth)} ${delCounts.laundryBusiness}`)
  console.log(`  ${"Stores".padEnd(labelWidth)} ${delCounts.stores}`)
  console.log(`  ${"Delivery Executives".padEnd(labelWidth)} ${delCounts.deliveryExecutives}`)
  console.log(`  ${"Services".padEnd(labelWidth)} ${delCounts.services}`)
  console.log(`  ${"Categories".padEnd(labelWidth)} ${delCounts.categories}`)
  console.log(`  ${"Garments".padEnd(labelWidth)} ${delCounts.garments}`)
  console.log(`  ${"Pricing Rules".padEnd(labelWidth)} ${delCounts.pricingRules}`)
  console.log(`  ${"Orders".padEnd(labelWidth)} ${delCounts.orders}`)
  console.log(`  ${"Customers (by LB id)".padEnd(labelWidth)} ${delCounts.customersViaLB}`)
  console.log(`  ${"Customers (by platform id)".padEnd(labelWidth)} ${delCounts.customersViaPlatform}`)
  console.log(`  ${"Bags".padEnd(labelWidth)} ${delCounts.bags}`)
  console.log(`  ${"Processing Packages".padEnd(labelWidth)} ${delCounts.processingPackages}`)
  console.log(`  ${"Notifications".padEnd(labelWidth)} ${delCounts.notifications}`)
  console.log(`  ${"Audit Logs".padEnd(labelWidth)} ${delCounts.auditLogs}`)
  console.log(`  ${"Financial Settings".padEnd(labelWidth)} ${delCounts.financialSettings}`)
  console.log(`  ${"Branding".padEnd(labelWidth)} ${delCounts.branding}`)
  console.log(`  ${"Operational Config".padEnd(labelWidth)} ${delCounts.operationalConfig}`)
  console.log(`  ${"RBAC Assignments".padEnd(labelWidth)} ${delCounts.rbacAssignments}`)
  console.log(`  ${"Pricing Rule Audits".padEnd(labelWidth)} ${delCounts.pricingRulesAudit}`)
  console.log(`  ${"─".repeat(labelWidth)} ─────`)
  console.log(`  ${"TOTAL".padEnd(labelWidth)} ${total}`)
  console.log()

  if (!isExecute) {
    console.log(`  ⚠ DRY RUN — no changes applied.`)
    console.log(`  Re-run with --execute to delete ${total} records across ${orphans.length} orphan businesses.`)
    console.log("=".repeat(70))
    return
  }

  // ── Execute deletion ─────────────────────────────────────────────────────
  console.log("  Executing cleanup…")
  console.log()

  await db.$transaction(async (tx) => {
    for (const o of orphans) {
      const lbId = o.lbId
      console.log(`    Processing: ${o.lbName} (${lbId})`)

      // Order-dependent records
      const orderIds = (await tx.laundryOrder.findMany({
        where: { businessId: lbId },
        select: { id: true },
      })).map((r) => r.id)

      if (orderIds.length > 0) {
        await tx.laundryBagRelease.deleteMany({ where: { orderId: { in: orderIds } } })
        await tx.laundryBagAssignment.deleteMany({ where: { orderId: { in: orderIds } } })
        await tx.laundryPickupBag.deleteMany({ where: { orderId: { in: orderIds } } })
        await tx.laundryProcessingPackage.deleteMany({ where: { orderId: { in: orderIds } } })
        await tx.laundryPacket.deleteMany({ where: { orderId: { in: orderIds } } })
        await tx.laundryPayment.deleteMany({ where: { orderId: { in: orderIds } } })
        await tx.laundryInvoice.deleteMany({ where: { orderId: { in: orderIds } } })
        await tx.laundryItemEvent.deleteMany({ where: { orderId: { in: orderIds } } })
        await tx.laundryOrderEvent.deleteMany({ where: { orderId: { in: orderIds } } })
        await tx.laundryOrderItem.deleteMany({ where: { orderId: { in: orderIds } } })
        await tx.laundryOrderService.deleteMany({ where: { orderId: { in: orderIds } } })
        await tx.laundryOrder.deleteMany({ where: { businessId: lbId } })
      }

      // Bags, packages (standalone)
      await tx.laundryBagRelease.deleteMany({ where: { businessId: lbId } })
      await tx.laundryBagAssignment.deleteMany({ where: { businessId: lbId } })
      await tx.laundryBag.deleteMany({ where: { businessId: lbId } })
      await tx.laundryProcessingPackage.deleteMany({ where: { businessId: lbId } })
      await tx.laundryPickupBag.deleteMany({ where: { businessId: lbId } })
      await tx.laundryPacket.deleteMany({ where: { businessId: lbId } })
      await tx.laundryPayment.deleteMany({ where: { businessId: lbId } })
      await tx.laundryInvoice.deleteMany({ where: { businessId: lbId } })
      await tx.laundryItemEvent.deleteMany({ where: { businessId: lbId } })

      // Audit logs
      await tx.laundryAuditLog.deleteMany({ where: { businessId: lbId } })

      // Pricing rule audits
      await tx.laundryPricingRuleAudit.deleteMany({ where: { businessId: lbId } })

      // RBAC assignments
      await tx.laundryAccessAssignment.deleteMany({ where: { businessId: lbId } })
      await tx.laundryAccessAudit.deleteMany({ where: { businessId: lbId } })

      // Notifications
      const bizIds = [lbId]
      if (o.platformBusinessId) bizIds.push(o.platformBusinessId)
      await tx.notification.deleteMany({ where: { businessId: { in: bizIds } } })

      // Customers by LaundryBusiness.id
      await deleteCustomersForBusiness(tx, lbId)
      // Customers by platformBusinessId
      if (o.platformBusinessId) {
        await deleteCustomersForBusiness(tx, o.platformBusinessId)
      }

      // Master data
      await tx.laundryDeliveryExecutiveReset.deleteMany({ where: { businessId: lbId } })
      await tx.laundryDeliveryExecutive.deleteMany({ where: { businessId: lbId } })
      await tx.laundryServiceGarmentCategory.deleteMany({ where: { businessId: lbId } })
      await tx.laundryService.deleteMany({ where: { businessId: lbId } })
      await tx.laundryCategory.deleteMany({ where: { businessId: lbId } })
      await tx.laundryGarment.deleteMany({ where: { businessId: lbId } })
      await tx.laundryPricingRule.deleteMany({ where: { businessId: lbId } })
      await tx.laundryPricingRuleAudit.deleteMany({ where: { businessId: lbId } })

      // Department / Workflow config
      await tx.laundryDepartment.deleteMany({ where: { businessId: lbId } })
      await tx.laundryWorkflowConfiguration.deleteMany({ where: { businessId: lbId } })

      // Config
      await tx.laundryFinancialSettings.deleteMany({ where: { businessId: lbId } })
      await tx.laundryBrandingConfig.deleteMany({ where: { businessId: lbId } })
      await tx.laundryOperationalConfig.deleteMany({ where: { businessId: lbId } })
      await tx.laundryWorkflowQualityConfig.deleteMany({ where: { businessId: lbId } })
      await tx.laundryScalingLimit.deleteMany({ where: { businessId: lbId } })
      await tx.laundryBusinessFeature.deleteMany({ where: { businessId: lbId } })

      // Stores
      const storeIds = (await tx.laundryStore.findMany({
        where: { laundryBusinessId: lbId },
        select: { id: true },
      })).map((s) => s.id)

      if (storeIds.length > 0) {
        await tx.laundryProcessingCenter.deleteMany({ where: { businessId: lbId } })
        await tx.laundryStore.deleteMany({ where: { laundryBusinessId: lbId } })
      }

      // Finally — the LaundryBusiness itself
      await tx.laundryBusiness.delete({ where: { id: lbId } })
      console.log(`    ✓ Deleted ${o.lbName}`)
    }
  })

  // ── Verify ───────────────────────────────────────────────────────────────
  console.log()
  console.log("  Verifying cleanup…")
  const remainingOrphans = await db.laundryBusiness.count({
    where: {
      id: { in: orphanIds },
    },
  })

  if (remainingOrphans === 0) {
    console.log(`  ✓ All ${orphans.length} orphan LaundryBusiness records deleted.`)
  } else {
    console.error(`  ✗ ${remainingOrphans} orphan LaundryBusiness records remain.`)
  }
  console.log("=".repeat(70))
}

async function deleteCustomersForBusiness(tx: any, businessId: string) {
  const customerIds = (await tx.customer.findMany({
    where: { businessId },
    select: { id: true },
  })).map((c: any) => c.id)

  if (customerIds.length === 0) return

  await tx.address.deleteMany({ where: { customerId: { in: customerIds } } })
  await tx.customerDocument.deleteMany({ where: { customerId: { in: customerIds } } })
  await tx.customerNote.deleteMany({ where: { customerId: { in: customerIds } } })
  await tx.customerActivity.deleteMany({ where: { customerId: { in: customerIds } } })
  await tx.customer.deleteMany({ where: { id: { in: customerIds } } })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
