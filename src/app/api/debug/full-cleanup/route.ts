// POST /api/debug/full-cleanup
// Body: { "confirm": "DELETE_ALL_BUSINESSES" }
//
// Deletes ALL businesses and every dependent record in FK-safe topological order.
// Uses explicit ID lookups (not nested-where) — safe with SQLite + Prisma.
// Also clears uploads/products/* and migration lock keys in PlatformConfig.
//
// Public — no auth. TEMP: remove after production reset confirmed.

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { existsSync, rmSync, readdirSync } from 'fs'
import { join } from 'path'

async function d<T extends { count: number }>(
  label: string,
  fn: () => Promise<T>,
  counts: Record<string, number>
) {
  const r = await fn()
  counts[label] = r.count
  return r
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    if (body?.confirm !== 'DELETE_ALL_BUSINESSES') {
      return NextResponse.json(
        {
          success: false,
          error:
            'Missing confirmation. Send body: { "confirm": "DELETE_ALL_BUSINESSES" }',
        },
        { status: 400 }
      )
    }

    const counts: Record<string, number> = {}

    // ── 0. Snapshot ───────────────────────────────────────────────────────
    const businesses = await db.business.findMany({
      select: { id: true, businessCode: true, name: true },
    })
    const bizIds = businesses.map((b) => b.id)
    counts.businesses = bizIds.length

    if (bizIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Nothing to delete — no businesses found.',
        counts,
      })
    }

    // ── Collect child IDs needed for leaf deletes ─────────────────────────
    const stores = await db.store.findMany({
      where: { businessId: { in: bizIds } },
      select: { id: true },
    })
    const storeIds = stores.map((s) => s.id)

    const orders = await db.order.findMany({
      where: { businessId: { in: bizIds } },
      select: { id: true },
    })
    const orderIds = orders.map((o) => o.id)

    const customers = await db.customer.findMany({
      where: { businessId: { in: bizIds } },
      select: { id: true },
    })
    const customerIds = customers.map((c) => c.id)

    const inventories = await db.inventory.findMany({
      where: { storeId: { in: storeIds } },
      select: { id: true },
    })
    const inventoryIds = inventories.map((i) => i.id)

    const products = await db.product.findMany({
      where: { businessId: { in: bizIds } },
      select: { id: true },
    })
    const productIds = products.map((p) => p.id)

    const custSubs = await db.customerSubscription.findMany({
      where: { businessId: { in: bizIds } },
      select: { id: true },
    })
    const custSubIds = custSubs.map((s) => s.id)

    const bizSubs = await db.businessSubscription.findMany({
      where: { businessId: { in: bizIds } },
      select: { id: true },
    })
    const bizSubIds = bizSubs.map((s) => s.id)

    const subPlans = await db.subscriptionPlan.findMany({
      where: { businessId: { in: bizIds } },
      select: { id: true },
    })
    const planIds = subPlans.map((p) => p.id)

    const bizUsers = await db.businessUser.findMany({
      where: { businessId: { in: bizIds } },
      select: { id: true },
    })
    const bizUserIds = bizUsers.map((u) => u.id)

    // ── Phase 1: Deep leaf records ────────────────────────────────────────

    if (inventoryIds.length > 0)
      await d('inventoryLog', () => db.inventoryLog.deleteMany({ where: { inventoryId: { in: inventoryIds } } }), counts)

    if (orderIds.length > 0) {
      await d('orderItem', () => db.orderItem.deleteMany({ where: { orderId: { in: orderIds } } }), counts)
      await d('orderStatusHistory', () => db.orderStatusHistory.deleteMany({ where: { orderId: { in: orderIds } } }), counts)
    }

    if (custSubIds.length > 0)
      await d('subscriptionUsage', () => db.subscriptionUsage.deleteMany({ where: { subscriptionId: { in: custSubIds } } }), counts)

    if (bizSubIds.length > 0)
      await d('billingRecord', () => db.billingRecord.deleteMany({ where: { businessSubscriptionId: { in: bizSubIds } } }), counts)

    if (planIds.length > 0)
      await d('subscriptionPlanItem', () => db.subscriptionPlanItem.deleteMany({ where: { planId: { in: planIds } } }), counts)

    if (customerIds.length > 0) {
      await d('address', () => db.address.deleteMany({ where: { customerId: { in: customerIds } } }), counts)
      await d('customerNote', () => db.customerNote.deleteMany({ where: { customerId: { in: customerIds } } }), counts)
    }

    if (bizUserIds.length > 0)
      await d('userStoreAssignment', () => db.userStoreAssignment.deleteMany({ where: { businessUserId: { in: bizUserIds } } }), counts)
    else if (storeIds.length > 0)
      await d('userStoreAssignment', () => db.userStoreAssignment.deleteMany({ where: { storeId: { in: storeIds } } }), counts)

    if (storeIds.length > 0)
      await d('storeTiming', () => db.storeTiming.deleteMany({ where: { storeId: { in: storeIds } } }), counts)

    // ── Phase 2: Second-level records ─────────────────────────────────────

    if (orderIds.length > 0)
      await d('delivery', () => db.delivery.deleteMany({ where: { orderId: { in: orderIds } } }), counts)

    await d('payment', () => db.payment.deleteMany({ where: { businessId: { in: bizIds } } }), counts)
    await d('review', () => db.review.deleteMany({ where: { businessId: { in: bizIds } } }), counts)
    await d('cartItem', () => db.cartItem.deleteMany({ where: { businessId: { in: bizIds } } }), counts)
    await d('favorite', () => db.favorite.deleteMany({ where: { businessId: { in: bizIds } } }), counts)
    await d('supportTicket', () => db.supportTicket.deleteMany({ where: { businessId: { in: bizIds } } }), counts)
    await d('invoice', () => db.invoice.deleteMany({ where: { businessId: { in: bizIds } } }), counts)

    // ── Phase 3: Orders and POS (must precede Store deletion) ─────────────

    await d('order', () => db.order.deleteMany({ where: { businessId: { in: bizIds } } }), counts)
    await d('posSession', () => db.pOSSession.deleteMany({ where: { businessId: { in: bizIds } } }), counts)

    // ── Phase 4: Inventory and Products ───────────────────────────────────

    await d('inventory', () => db.inventory.deleteMany({ where: { storeId: { in: storeIds } } }), counts)

    if (productIds.length > 0)
      await d('productVariant', () => db.productVariant.deleteMany({ where: { productId: { in: productIds } } }), counts)

    await d('product', () => db.product.deleteMany({ where: { businessId: { in: bizIds } } }), counts)
    await d('category', () => db.category.deleteMany({ where: { businessId: { in: bizIds } } }), counts)

    // ── Phase 5: Customers ────────────────────────────────────────────────

    await d('customerSubscription', () => db.customerSubscription.deleteMany({ where: { businessId: { in: bizIds } } }), counts)
    await d('customer', () => db.customer.deleteMany({ where: { businessId: { in: bizIds } } }), counts)

    // ── Phase 6: Store-level records (before Store) ───────────────────────

    await d('storePaymentGateway', () => db.storePaymentGateway.deleteMany({ where: { businessId: { in: bizIds } } }), counts)
    await d('deliveryZone', () => db.deliveryZone.deleteMany({ where: { businessId: { in: bizIds } } }), counts)
    await d('workflowRule', () => db.workflowRule.deleteMany({ where: { businessId: { in: bizIds } } }), counts)
    await d('taxConfig', () => db.taxConfig.deleteMany({ where: { businessId: { in: bizIds } } }), counts)
    await d('businessUser', () => db.businessUser.deleteMany({ where: { businessId: { in: bizIds } } }), counts)
    await d('deliveryPartner', () => db.deliveryPartner.deleteMany({ where: { businessId: { in: bizIds } } }), counts)
    await d('promoCode', () => db.promoCode.deleteMany({ where: { businessId: { in: bizIds } } }), counts)
    await d('store', () => db.store.deleteMany({ where: { businessId: { in: bizIds } } }), counts)

    // ── Phase 7: Business-level records ───────────────────────────────────

    await d('subscriptionPlan', () => db.subscriptionPlan.deleteMany({ where: { businessId: { in: bizIds } } }), counts)
    await d('businessSubscription', () => db.businessSubscription.deleteMany({ where: { businessId: { in: bizIds } } }), counts)
    await d('businessGatewayAccess', () => db.businessGatewayAccess.deleteMany({ where: { businessId: { in: bizIds } } }), counts)
    await d('paymentGateway', () => db.paymentGateway.deleteMany({ where: { businessId: { in: bizIds } } }), counts)
    await d('notification', () => db.notification.deleteMany({ where: { businessId: { in: bizIds } } }), counts)
    await d('businessAuditLog', () => db.businessAuditLog.deleteMany({ where: { businessId: { in: bizIds } } }), counts)
    await d('businessBranding', () => db.businessBranding.deleteMany({ where: { businessId: { in: bizIds } } }), counts)
    await d('appConfig', () => db.appConfig.deleteMany({ where: { businessId: { in: bizIds } } }), counts)
    await d('featureFlag', () => db.featureFlag.deleteMany({ where: { businessId: { in: bizIds } } }), counts)
    await d('onboardingStep', () => db.onboardingStep.deleteMany({ where: { businessId: { in: bizIds } } }), counts)
    await d('businessModule', () => db.businessModule.deleteMany({ where: { businessId: { in: bizIds } } }), counts)
    await d('businessRole', () => db.businessRole.deleteMany({ where: { businessId: { in: bizIds } } }), counts)

    // ── Phase 8: Non-cascaded FK relations ────────────────────────────────

    // ActivityLog: optional FK — nullify to preserve platform audit trail
    const r_actLog = await db.activityLog.updateMany({
      where: { businessId: { in: bizIds } },
      data: { businessId: null },
    })
    counts.activityLogNullified = r_actLog.count

    // Lead.convertedBusinessId: optional FK — nullify
    const r_lead = await db.lead.updateMany({
      where: { convertedBusinessId: { in: bizIds } },
      data: { convertedBusinessId: null, convertedAt: null },
    })
    counts.leadConversionNullified = r_lead.count

    // DomainMapping: required FK, no cascade — MUST delete before Business
    await d('domainMapping', () => db.domainMapping.deleteMany({ where: { businessId: { in: bizIds } } }), counts)

    // Deployment: required FK, no cascade — MUST delete before Business
    await d('deployment', () => db.deployment.deleteMany({ where: { businessId: { in: bizIds } } }), counts)

    // ── Phase 9: Clear migration lock keys ────────────────────────────────
    const migrationKeys = [
      'migration:store_code_backfill_v4',
      'migration:store_code_backfill_v3',
      'migration:store_code_backfill_v2',
      'migration:store_code_backfill_v1',
      'migration:store_storeCode_constraint_v1',
    ]
    const r_cfg = await db.platformConfig.deleteMany({ where: { key: { in: migrationKeys } } })
    counts.platformConfigKeysCleared = r_cfg.count

    // ── Phase 10: Delete businesses ───────────────────────────────────────
    await d('businessDeleted', () => db.business.deleteMany({ where: { id: { in: bizIds } } }), counts)

    // ── Phase 11: Clean uploads/products/* ───────────────────────────────
    const uploadsDir = join(process.cwd(), 'uploads', 'products')
    let filesCleared = 0
    let uploadsCleaned = false
    if (existsSync(uploadsDir)) {
      try {
        filesCleared = readdirSync(uploadsDir).length
        rmSync(uploadsDir, { recursive: true, force: true })
        uploadsCleaned = true
      } catch {
        counts.uploadsCleanError = 1
      }
    }
    counts.uploadFilesCleared = filesCleared
    counts.uploadsCleaned = uploadsCleaned ? 1 : 0

    return NextResponse.json({
      success: true,
      message: `Deleted ${businesses.length} business(es) and all dependent data.`,
      deletedBusinesses: businesses.map((b) => ({
        id: b.id,
        businessCode: b.businessCode,
        name: b.name,
      })),
      counts,
      notes: [
        'Migration lock keys cleared — startup auto-repair will re-run on next deploy.',
        'ActivityLog.businessId set to null — platform audit trail preserved.',
        'Lead.convertedBusinessId cleared — leads kept, conversion link removed.',
        'User accounts (admin/staff) are NOT deleted — only BusinessUser memberships removed.',
        'MANUAL STEP: Clear browser localStorage key "admin-store" to reset Zustand state.',
        'BusinessCode sequence resets naturally — next business creation gets BUS-YYYYMM-0001.',
      ],
    })
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
