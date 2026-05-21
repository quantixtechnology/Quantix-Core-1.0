// ============================================================================
// GET /api/debug/store-codes
//
// Returns verification status for every store across all businesses.
// Computes the expected storeCode and compares with what is actually stored.
//
// Response per store:
//   businessCode, storeName, currentStoreCode, expectedStoreCode, status (OK|NEEDS_REPAIR)
//
// Used by the Operations Dashboard → Data Repair → Verify Store Codes button.
// Requires QUANTIX_SUPER_ADMIN role.
// ============================================================================

import { NextResponse } from 'next/server'
import { withMiddleware } from '@/lib/middleware'
import { verifyStoreCodes } from '@/lib/migrations/backfill-store-codes'

export const GET = withMiddleware({
  requireAuth: true,
  requiredRoles: ['QUANTIX_SUPER_ADMIN'],
})(async () => {
  try {
    const results = await verifyStoreCodes()
    const needsRepair = results.filter(s => s.status === 'NEEDS_REPAIR')
    return NextResponse.json({
      success: true,
      summary: {
        total: results.length,
        ok: results.length - needsRepair.length,
        needsRepair: needsRepair.length,
        healthy: needsRepair.length === 0,
      },
      data: results,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Verification failed'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
