// GET /api/debug/cleanup-audit
// Verifies post-cleanup state. Expected after full-cleanup:
//   businesses=0, stores=0, legacyCodes=0
//
// Public — no auth. TEMP: remove after reset confirmed.

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { existsSync, readdirSync } from 'fs'
import { join } from 'path'

const LEGACY_REGEX = /^(STR-\d{3,}|STO-|BUS-.*-\d{3}$)/

export async function GET() {
  try {
    // ── 1. Business + Store counts ────────────────────────────────────────
    const businesses = await db.business.findMany({
      select: { id: true, businessCode: true, name: true, status: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    })

    const stores = await db.store.findMany({
      select: {
        id: true,
        name: true,
        storeCode: true,
        businessId: true,
        isMainStore: true,
      },
    })

    // ── 2. Legacy store codes ─────────────────────────────────────────────
    const legacyCodes = stores.filter(
      (s) => s.storeCode && LEGACY_REGEX.test(s.storeCode)
    )

    // ── 3. Orphaned records check ─────────────────────────────────────────
    const orphanedOrders = await db.order.count({
      where: { businessId: { notIn: businesses.map((b) => b.id) } },
    })
    const orphanedCustomers = await db.customer.count({
      where: { businessId: { notIn: businesses.map((b) => b.id) } },
    })
    const orphanedInventory = await db.inventory.count({
      where: { store: { businessId: { notIn: businesses.map((b) => b.id) } } },
    })

    // ── 4. Migration lock keys ────────────────────────────────────────────
    const migrationKeys = await db.platformConfig.findMany({
      where: {
        key: {
          in: [
            'migration:store_code_backfill_v4',
            'migration:store_code_backfill_v3',
            'migration:store_storeCode_constraint_v1',
          ],
        },
      },
      select: { key: true, value: true, updatedAt: true },
    })

    // ── 5. Uploads directory ──────────────────────────────────────────────
    const uploadsDir = join(process.cwd(), 'uploads', 'products')
    const uploadsDirExists = existsSync(uploadsDir)
    const uploadsFileCount = uploadsDirExists ? readdirSync(uploadsDir).length : 0

    // ── 6. Platform Users (admin/staff — should still exist) ──────────────
    const platformUsers = await db.user.count({
      where: { platformRole: { not: null } },
    })

    // ── 7. Leads with dangling convertedBusinessId ────────────────────────
    const bizIds = businesses.map((b) => b.id)
    const danglingLeads = bizIds.length === 0
      ? await db.lead.count({ where: { convertedBusinessId: { not: null } } })
      : 0

    // ── Summary ───────────────────────────────────────────────────────────
    const allClear =
      businesses.length === 0 &&
      stores.length === 0 &&
      legacyCodes.length === 0 &&
      orphanedOrders === 0 &&
      orphanedCustomers === 0 &&
      uploadsFileCount === 0

    return NextResponse.json({
      success: true,
      allClear,
      summary: {
        businesses: businesses.length,
        stores: stores.length,
        legacyCodes: legacyCodes.length,
        orphanedOrders,
        orphanedCustomers,
        orphanedInventory,
        migrationLocksActive: migrationKeys.length,
        uploadsFileCount,
        platformUsers,
        danglingLeadConversions: danglingLeads,
      },
      businesses,
      stores,
      legacyCodeDetails: legacyCodes,
      migrationLocks: migrationKeys,
      verdict: allClear
        ? '✅ Clean — ready for fresh BUS-202605-0001 creation.'
        : '⚠️  Not clean — see summary fields above for remaining data.',
    })
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
