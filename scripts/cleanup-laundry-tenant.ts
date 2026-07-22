/**
 * Reset active Laundry tenant — delete ALL operational/test data.
 *
 * Preserves: LaundryBusiness, Platform Business, Stores, Services,
 *            Categories, Garments, Pricing, Delivery Executives, Users,
 *            Roles, Permissions, Branding, Configuration, Subscriptions.
 *
 * Usage:
 *   DRY RUN:  npx ts-node -r tsconfig-paths/register scripts/cleanup-laundry-tenant.ts
 *   APPLY:    npx ts-node -r tsconfig-paths/register scripts/cleanup-laundry-tenant.ts --execute
 *
 * The script always prints a summary first and requires --execute to write.
 */

import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()

// ── TARGET ───────────────────────────────────────────────────────────────────
const TARGET_LB_ID = "cmr3136pv0007qkwkg2irf3tm"
const TARGET_PLATFORM_ID = "cmqjfpuvj0000qkjzv9i7pcae"
const TARGET_NAME = "Laundry & Drycleaners"

async function main() {
  const isExecute = process.argv.includes("--execute")
  const businessIds = [TARGET_LB_ID, TARGET_PLATFORM_ID]

  console.log("=".repeat(70))
  console.log(`  TENANT RESET: ${TARGET_NAME}`)
  console.log(`  LaundryBusiness: ${TARGET_LB_ID}`)
  console.log(`  Platform Business: ${TARGET_PLATFORM_ID}`)
  console.log()

  // ── Count every deletable record ──────────────────────────────────────────
  const orderIds = (
    await db.laundryOrder.findMany({
      where: { businessId: TARGET_LB_ID },
      select: { id: true },
    })
  ).map((o) => o.id)

  const counts = {
    // ── Customers ──
    customers: await db.customer.count({
      where: { businessId: { in: businessIds } },
    }),
    addresses: await db.address.count({
      where: { customer: { businessId: { in: businessIds } } },
    }),
    customerDocuments: await db.customerDocument.count({
      where: { businessId: { in: businessIds } },
    }),
    customerNotes: await db.customerNote.count({
      where: { customer: { businessId: { in: businessIds } } },
    }),
    customerActivities: await db.customerActivity.count({
      where: { businessId: { in: businessIds } },
    }),

    // ── Orders ──
    orders: orderIds.length,
    orderItems: await db.laundryOrderItem.count({
      where: { orderId: { in: orderIds } },
    }),
    orderServices: await db.laundryOrderService.count({
      where: { orderId: { in: orderIds } },
    }),
    orderEvents: await db.laundryOrderEvent.count({
      where: { orderId: { in: orderIds } },
    }),

    // ── Bag / Package / Packet ──
    bagReleases: await db.laundryBagRelease.count({
      where: { OR: [{ businessId: TARGET_LB_ID }, { orderId: { in: orderIds } }] },
    }),
    bagAssignments: await db.laundryBagAssignment.count({
      where: { OR: [{ businessId: TARGET_LB_ID }, { orderId: { in: orderIds } }] },
    }),
    bags: await db.laundryBag.count({ where: { businessId: TARGET_LB_ID } }),
    pickupBags: await db.laundryPickupBag.count({ where: { businessId: TARGET_LB_ID } }),
    processingPackages: await db.laundryProcessingPackage.count({
      where: { businessId: TARGET_LB_ID },
    }),
    packets: await db.laundryPacket.count({ where: { businessId: TARGET_LB_ID } }),

    // ── Payments & Invoices ──
    payments: await db.laundryPayment.count({ where: { businessId: TARGET_LB_ID } }),
    invoices: await db.laundryInvoice.count({ where: { businessId: TARGET_LB_ID } }),

    // ── Event / Audit history ──
    itemEvents: await db.laundryItemEvent.count({ where: { businessId: TARGET_LB_ID } }),
    auditLogs: await db.laundryAuditLog.count({ where: { businessId: TARGET_LB_ID } }),

    // ── CRM operational data ──
    crmActivities: await db.laundryCrmActivity.count({ where: { businessId: TARGET_LB_ID } }),
    crmEvents: await db.laundryCrmEvent.count({ where: { businessId: TARGET_LB_ID } }),
    crmTasks: await db.laundryCrmTask.count({ where: { businessId: TARGET_LB_ID } }),
    crmLeads: await db.laundryCrmLead.count({ where: { businessId: TARGET_LB_ID } }),
    crmOpportunities: await db.laundryCrmOpportunity.count({ where: { businessId: TARGET_LB_ID } }),

    // ── Notifications ──
    notifications: await db.notification.count({
      where: { businessId: { in: businessIds } },
    }),

    // ── Uploads ──
    uploads: await db.fileUpload.count({ where: { businessId: TARGET_LB_ID } }),
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0)

  // ── Print summary ─────────────────────────────────────────────────────────
  const rows: [string, number][] = [
    ["Customers", counts.customers],
    ["Customer Addresses", counts.addresses],
    ["Customer Documents", counts.customerDocuments],
    ["Customer Notes", counts.customerNotes],
    ["Customer Activities", counts.customerActivities],
    ["Orders", counts.orders],
    ["Order Items", counts.orderItems],
    ["Order Services", counts.orderServices],
    ["Order Events (Status History)", counts.orderEvents],
    ["Bag Releases", counts.bagReleases],
    ["Bag Assignments", counts.bagAssignments],
    ["Bags", counts.bags],
    ["Pickup Bags", counts.pickupBags],
    ["Processing Packages", counts.processingPackages],
    ["Packets", counts.packets],
    ["Payments", counts.payments],
    ["Invoices", counts.invoices],
    ["Item Events", counts.itemEvents],
    ["Audit Logs", counts.auditLogs],
    ["CRM Activities", counts.crmActivities],
    ["CRM Events", counts.crmEvents],
    ["CRM Tasks", counts.crmTasks],
    ["CRM Leads", counts.crmLeads],
    ["CRM Opportunities", counts.crmOpportunities],
    ["Notifications", counts.notifications],
    ["File Uploads", counts.uploads],
  ]

  console.log("  ┌──────────────────────────────────────┬────────┐")
  for (const [label, value] of rows) {
    if (value > 0 || label === "Orders") {
      console.log(`  │ ${label.padEnd(36)}│ ${String(value).padStart(6)} │`)
    }
  }
  console.log("  └──────────────────────────────────────┴────────┘")
  console.log()
  console.log(`  TOTAL RECORDS TO DELETE: ${total}`)
  console.log()

  if (total === 0) {
    console.log("  ✓ Tenant is already clean.")
    console.log("=".repeat(70))
    return
  }

  if (!isExecute) {
    console.log(`  ⚠ DRY RUN — no changes applied.`)
    console.log(`  Re-run with --execute to delete ${total} records.`)
    console.log("=".repeat(70))
    return
  }

  // ── Execute deletion ────────────────────────────────────────────────────
  console.log("  Executing cleanup in transaction…")
  console.log()

  await db.$transaction(async (tx) => {
    // ── 1. Order-dependent (children before parent) ─────────────────────────
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
      await tx.laundryOrder.deleteMany({ where: { businessId: TARGET_LB_ID } })
    }

    // ── 2. Standalone bags / packages (not linked to current orders) ────────
    await tx.laundryBagRelease.deleteMany({ where: { businessId: TARGET_LB_ID } })
    await tx.laundryBagAssignment.deleteMany({ where: { businessId: TARGET_LB_ID } })
    await tx.laundryBag.deleteMany({ where: { businessId: TARGET_LB_ID } })
    await tx.laundryPickupBag.deleteMany({ where: { businessId: TARGET_LB_ID } })
    await tx.laundryProcessingPackage.deleteMany({ where: { businessId: TARGET_LB_ID } })
    await tx.laundryPacket.deleteMany({ where: { businessId: TARGET_LB_ID } })
    await tx.laundryPayment.deleteMany({ where: { businessId: TARGET_LB_ID } })
    await tx.laundryInvoice.deleteMany({ where: { businessId: TARGET_LB_ID } })
    await tx.laundryItemEvent.deleteMany({ where: { businessId: TARGET_LB_ID } })

    // ── 3. Event / Audit history ────────────────────────────────────────────
    await tx.laundryOrderEvent.deleteMany({ where: { businessId: TARGET_LB_ID } })
    await tx.laundryAuditLog.deleteMany({ where: { businessId: TARGET_LB_ID } })

    // ── 4. CRM operational data ─────────────────────────────────────────────
    await tx.laundryCrmStageHistory.deleteMany({ where: { businessId: TARGET_LB_ID } })
    await tx.laundryCrmActivity.deleteMany({ where: { businessId: TARGET_LB_ID } })
    await tx.laundryCrmEvent.deleteMany({ where: { businessId: TARGET_LB_ID } })
    await tx.laundryCrmTask.deleteMany({ where: { businessId: TARGET_LB_ID } })
    await tx.laundryCrmLead.deleteMany({ where: { businessId: TARGET_LB_ID } })
    await tx.laundryCrmOpportunity.deleteMany({ where: { businessId: TARGET_LB_ID } })

    // ── 5. Notifications ────────────────────────────────────────────────────
    await tx.notification.deleteMany({
      where: { businessId: { in: businessIds } },
    })

    // ── 6. File uploads ─────────────────────────────────────────────────────
    await tx.fileUpload.deleteMany({ where: { businessId: TARGET_LB_ID } })

    // ── 7. Customer data ────────────────────────────────────────────────────
    const customerIds = (
      await tx.customer.findMany({
        where: { businessId: { in: businessIds } },
        select: { id: true },
      })
    ).map((c) => c.id)

    if (customerIds.length > 0) {
      await tx.customerSubscription.deleteMany({ where: { customerId: { in: customerIds } } })
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
    customers: await db.customer.count({
      where: { businessId: { in: businessIds } },
    }),
    addresses: await db.address.count({
      where: { customer: { businessId: { in: businessIds } } },
    }),
    bagAssignments: await db.laundryBagAssignment.count({
      where: { businessId: TARGET_LB_ID },
    }),
    bags: await db.laundryBag.count({ where: { businessId: TARGET_LB_ID } }),
    packages: await db.laundryProcessingPackage.count({
      where: { businessId: TARGET_LB_ID } }),
    payments: await db.laundryPayment.count({ where: { businessId: TARGET_LB_ID } }),
    invoices: await db.laundryInvoice.count({ where: { businessId: TARGET_LB_ID } }),
    notifications: await db.notification.count({
      where: { businessId: { in: businessIds } },
    }),
    uploads: await db.fileUpload.count({ where: { businessId: TARGET_LB_ID } }),
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
    console.error("  ✗ Some records remain. Review above.")
  }
  console.log("=".repeat(70))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
