/**
 * Cleanup all operational/test data for a specific LaundryBusiness.
 *
 * Keeps: LaundryBusiness, Platform Business, Stores, Services, Categories,
 *        Pricing, Delivery Executives, Users, Configuration, Branding
 *
 * Deletes: Orders, Items, Events, Bags, Packages, Payments, Invoices,
 *          Notifications, Customers, Addresses, QR/Barcode data
 *
 * Usage:
 *   DRY RUN:           npx ts-node -r tsconfig-paths/register scripts/cleanup-laundry-tenant.ts
 *   APPLY:             npx ts-node -r tsconfig-paths/register scripts/cleanup-laundry-tenant.ts --execute
 *
 * Configure TARGET_LB_ID at the top of main().
 */

import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()

// ── TARGET ───────────────────────────────────────────────────────────────────
const TARGET_LB_ID = "cmr3136pv0007qkwkg2irf3tm"
const TARGET_NAME = "Laundry & Drycleaners"

async function main() {
  const isExecute = process.argv.includes("--execute")
  console.log("=".repeat(60))
  console.log(`  Cleanup: ${TARGET_NAME}`)
  console.log(`  LaundryBusiness: ${TARGET_LB_ID}`)
  console.log()

  // ── Fetch metadata ──────────────────────────────────────────────────────────
  const lb = await db.laundryBusiness.findUnique({
    where: { id: TARGET_LB_ID },
    select: { id: true, platformBusinessId: true, businessName: true },
  })

  if (!lb) {
    console.error(`  ✗ LaundryBusiness ${TARGET_LB_ID} not found.`)
    process.exit(1)
  }

  const platformId = lb.platformBusinessId
  const businessIds = [TARGET_LB_ID]
  if (platformId) businessIds.push(platformId)

  console.log(`  Platform Business ID: ${platformId || "null"}`)
  console.log(`  Querying with businessIds: ${businessIds.join(", ")}`)
  console.log()

  // ── Count summaries ─────────────────────────────────────────────────────────
  const counts = {
    orders: await db.laundryOrder.count({ where: { businessId: TARGET_LB_ID } }),
    orderEvents: await db.laundryOrderEvent.count({ where: { businessId: TARGET_LB_ID } }),
    orderServices: await db.laundryOrderService.count({
      where: { order: { businessId: TARGET_LB_ID } },
    }),
    orderItems: await db.laundryOrderItem.count({
      where: { order: { businessId: TARGET_LB_ID } },
    }),
    customers: await db.customer.count({
      where: { businessId: { in: businessIds } },
    }),
    customerAddresses: await db.address.count({
      where: { customer: { businessId: { in: businessIds } } },
    }),
    customerDocuments: await db.customerDocument.count({
      where: { businessId: { in: businessIds } },
    }),
    customerActivities: await db.customerActivity.count({
      where: { businessId: { in: businessIds } },
    }),
    customerNotes: await db.customerNote.count({
      where: { customer: { businessId: { in: businessIds } } },
    }),
    bags: await db.laundryBag.count({ where: { businessId: TARGET_LB_ID } }),
    bagAssignments: await db.laundryBagAssignment.count({ where: { businessId: TARGET_LB_ID } }),
    bagReleases: await db.laundryBagRelease.count({ where: { businessId: TARGET_LB_ID } }),
    pickupBags: await db.laundryPickupBag.count({ where: { businessId: TARGET_LB_ID } }),
    processingPackages: await db.laundryProcessingPackage.count({ where: { businessId: TARGET_LB_ID } }),
    packets: await db.laundryPacket.count({ where: { businessId: TARGET_LB_ID } }),
    payments: await db.laundryPayment.count({ where: { businessId: TARGET_LB_ID } }),
    invoices: await db.laundryInvoice.count({ where: { businessId: TARGET_LB_ID } }),
    notifications: await db.notification.count({
      where: { businessId: { in: businessIds } },
    }),
    auditLogs: await db.laundryAuditLog.count({ where: { businessId: TARGET_LB_ID } }),
    itemEvents: await db.laundryItemEvent.count({ where: { businessId: TARGET_LB_ID } }),
    // Garments — user-defined product catalog, NOT operational data
    // garments: await db.laundryGarment.count({ where: { businessId: TARGET_LB_ID } }),
  }

  console.log("  ┌──────────────────────────────────────┬────────┐")
  for (const [key, value] of Object.entries(counts)) {
    const label = key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())
    console.log(`  │ ${label.padEnd(36)}│ ${String(value).padStart(6)} │`)
  }
  console.log("  └──────────────────────────────────────┴────────┘")
  console.log()

  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  if (total === 0) {
    console.log("  ✓ No operational data to clean. Tenant is already clean.\n")
    return
  }

  if (!isExecute) {
    console.log(`  ⚠ DRY RUN — no changes applied.`)
    console.log(`  Re-run with --execute to delete ${total} records.`)
    console.log("=".repeat(60))
    return
  }

  console.log(`  Executing cleanup in transaction…`)
  console.log()

  await db.$transaction(async (tx) => {
    // ── Order-dependent records (children first) ────────────────────────────

    // Items, Services, Events cascade from LaundryOrder at DB level.
    // Delete manually to be explicit.
    const orderIds = (
      await tx.laundryOrder.findMany({
        where: { businessId: TARGET_LB_ID },
        select: { id: true },
      })
    ).map((o) => o.id)

    if (orderIds.length > 0) {
      // Bags linked to orders
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

      // Orders themselves
      await tx.laundryOrder.deleteMany({ where: { businessId: TARGET_LB_ID } })
    }

    // ── Standalone bags (not linked to any current order) ───────────────────
    await tx.laundryBagRelease.deleteMany({ where: { businessId: TARGET_LB_ID } })
    await tx.laundryBagAssignment.deleteMany({ where: { businessId: TARGET_LB_ID } })
    await tx.laundryBag.deleteMany({ where: { businessId: TARGET_LB_ID } })

    // ── Standalone processing packages ────────────────────────────────────
    await tx.laundryProcessingPackage.deleteMany({ where: { businessId: TARGET_LB_ID } })

    // ── Audit logs ─────────────────────────────────────────────────────────
    await tx.laundryAuditLog.deleteMany({ where: { businessId: TARGET_LB_ID } })

    // ── Notifications ──────────────────────────────────────────────────────
    await tx.notification.deleteMany({ where: { businessId: { in: businessIds } } })

    // ── Customer data ──────────────────────────────────────────────────────
    const customerIds = (
      await tx.customer.findMany({
        where: { businessId: { in: businessIds } },
        select: { id: true },
      })
    ).map((c) => c.id)

    if (customerIds.length > 0) {
      await tx.customerDocument.deleteMany({ where: { customerId: { in: customerIds } } })
      await tx.customerNote.deleteMany({ where: { customerId: { in: customerIds } } })
      await tx.address.deleteMany({ where: { customerId: { in: customerIds } } })
      await tx.customerActivity.deleteMany({ where: { customerId: { in: customerIds } } })
      await tx.customer.deleteMany({ where: { id: { in: customerIds } } })
    }
  })

  // ── Verify ──────────────────────────────────────────────────────────────────
  console.log("  Verifying cleanup…")
  const remaining = {
    orders: await db.laundryOrder.count({ where: { businessId: TARGET_LB_ID } }),
    customers: await db.customer.count({ where: { businessId: { in: businessIds } } }),
    bagAssignments: await db.laundryBagAssignment.count({ where: { businessId: TARGET_LB_ID } }),
    bags: await db.laundryBag.count({ where: { businessId: TARGET_LB_ID } }),
    packages: await db.laundryProcessingPackage.count({ where: { businessId: TARGET_LB_ID } }),
  }

  let allClean = true
  for (const [key, value] of Object.entries(remaining)) {
    const ok = value === 0 ? "✓" : "✗"
    if (value !== 0) allClean = false
    console.log(`  ${ok} ${key}: ${value}`)
  }

  if (allClean) {
    console.log()
    console.log("  ✓ Cleanup complete. Tenant is ready for UAT.")
  } else {
    console.log()
    console.error("  ✗ Some records remain. Check logs above.")
  }
  console.log("=".repeat(60))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
