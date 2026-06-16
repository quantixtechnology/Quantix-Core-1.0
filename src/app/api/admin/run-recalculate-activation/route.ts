// ============================================================================
// QUANTIX CORE — Recalculate Activation for All Businesses
// POST /api/admin/run-recalculate-activation
//   — Runs evaluateActivation() for every business in the database.
//   — Super admin only.
// ============================================================================

import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { evaluateActivation } from '@/lib/core/business';

export const POST = withMiddleware({
  requireAuth: true,
  requiredPermission: 'businesses:edit',
})(async () => {
  try {
    const businesses = await db.business.findMany({ select: { id: true, name: true } });
    const results: { id: string; name: string; status: string; error?: string }[] = [];

    for (const biz of businesses) {
      try {
        const updated = await evaluateActivation(biz.id);
        results.push({ id: biz.id, name: biz.name, status: updated.status });
      } catch (err) {
        results.push({ id: biz.id, name: biz.name, status: 'ERROR', error: err instanceof Error ? err.message : 'Unknown error' });
      }
    }

    return NextResponse.json({ success: true, data: results, total: results.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to recalculate activation';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
