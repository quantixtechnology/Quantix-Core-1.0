// ============================================================================
// POST /api/admin/migrate/backfill-store-codes
//
// Backfills storeCode (STO-YYYYMM-NNNN) for all stores that have a missing
// or old-format code (STR-XXXXX). Run once after deploying the store-code system.
//
// Rules:
//   - Per-business sequence starting at 0001.
//   - Primary store (isMainStore=true) always gets the lowest sequence number.
//   - YYYYMM is derived from the store's createdAt date.
//   - Idempotent: only updates stores whose storeCode IS NULL or starts with "STR-".
//
// Requires QUANTIX_SUPER_ADMIN role.
// ============================================================================

import { NextResponse } from 'next/server'
import { withMiddleware } from '@/lib/middleware'
import { db } from '@/lib/db'

export const POST = withMiddleware({
  requireAuth: true,
  requiredRoles: ['QUANTIX_SUPER_ADMIN'],
})(async () => {
  try {
    // Fetch all businesses with their stores (ordered so main store comes first)
    const businesses = await db.business.findMany({
      select: { id: true, name: true, businessCode: true },
      orderBy: { createdAt: 'asc' },
    })

    const updated: { businessCode: string; businessName: string; storeName: string; storeCode: string }[] = []
    const skipped: { businessCode: string; storeName: string; existingCode: string }[] = []

    for (const business of businesses) {
      // Fetch stores sorted: main store first, then by createdAt
      const stores = await db.store.findMany({
        where: { businessId: business.id },
        orderBy: [{ isMainStore: 'desc' }, { createdAt: 'asc' }],
        select: { id: true, name: true, storeCode: true, isMainStore: true, createdAt: true },
      })

      let seq = 1
      for (const store of stores) {
        // Skip if already has a valid STO- code
        if (store.storeCode && store.storeCode.startsWith('STO-')) {
          skipped.push({
            businessCode: business.businessCode ?? business.id,
            storeName: store.name,
            existingCode: store.storeCode,
          })
          seq++ // Still advance sequence so next stores get the right number
          continue
        }

        // Generate code using the store's creation date for YYYYMM
        const d = store.createdAt
        const yyyymm = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`
        const newCode = `STO-${yyyymm}-${String(seq).padStart(4, '0')}`

        await db.store.update({
          where: { id: store.id },
          data: { storeCode: newCode },
        })

        updated.push({
          businessCode: business.businessCode ?? business.id,
          businessName: business.name,
          storeName: store.name,
          storeCode: newCode,
        })
        seq++
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        businessesProcessed: businesses.length,
        storesUpdated: updated.length,
        storesSkipped: skipped.length,
      },
      updated,
      skipped,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Backfill failed'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
