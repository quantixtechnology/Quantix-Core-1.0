// GET /api/debug/store-codes
// Returns verification status for every store across all businesses.
// Requires QUANTIX_SUPER_ADMIN role.

import { NextResponse } from 'next/server'
import { withMiddleware } from '@/lib/middleware'
import { verifyStoreCodes } from '@/lib/migrations/backfill-store-codes'

export const GET = withMiddleware({
  requireAuth: true,
  requiredRoles: ['QUANTIX_SUPER_ADMIN'],
})(async () => {
  try {
    const results = await verifyStoreCodes()
    const invalid = results.filter(s => s.status === 'INVALID')
    return NextResponse.json({
      success: true,
      summary: {
        total: results.length,
        ok: results.length - invalid.length,
        invalid: invalid.length,
        healthy: invalid.length === 0,
      },
      data: results.map(s => ({
        businessCode: s.businessCode,
        storeName: s.storeName,
        storeCode: s.storeCode,
        storeSequence: s.storeSequence,
        isMainStore: s.isMainStore,
        status: s.status,
      })),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Verification failed'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
