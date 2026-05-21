// ============================================================================
// POST /api/admin/migrate/backfill-store-codes?force=true
//
// Admin-triggered store code backfill. Uses the same shared logic as the
// auto-startup migration. Pass force=true to re-run even if already completed
// (useful from the Operations Dashboard UI).
//
// Requires QUANTIX_SUPER_ADMIN role.
// ============================================================================

import { NextResponse } from 'next/server'
import { withMiddleware } from '@/lib/middleware'
import { runStoreCodeBackfill } from '@/lib/migrations/backfill-store-codes'

export const POST = withMiddleware({
  requireAuth: true,
  requiredRoles: ['QUANTIX_SUPER_ADMIN'],
})(async (req) => {
  try {
    const { searchParams } = new URL(req.url)
    const force = searchParams.get('force') === 'true'

    const result = await runStoreCodeBackfill(force)

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Backfill failed'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
