// ============================================================================
// ONE-TIME MIGRATION: Rename old LeadStage enum values to new sales pipeline stages
//
// Run once after deploying the new stage enum.
// Safe to run multiple times — only updates rows that still have old values.
//
// Mapping:
//   DEMO_SHARED  → DEMO_DONE
//   ONBOARDING   → CLOSED_WON
//   DEPLOYMENT   → CLOSED_WON
//   ACTIVE       → CLOSED_WON
//   CHURNED      → LOST
// ============================================================================

import { withPlatformAccess, createSuccessResponse, createErrorResponse } from '@/lib/middleware';
import { db } from '@/lib/db';
import type { NextRequest } from 'next/server';
import type { LeadStage } from '@/lib/types';

type StageEntry = { from: LeadStage; to: LeadStage };

const STAGE_MIGRATIONS: StageEntry[] = [
  { from: 'DEMO_SHARED' as LeadStage, to: 'DEMO_DONE' },
  { from: 'ONBOARDING'  as LeadStage, to: 'CLOSED_WON' },
  { from: 'DEPLOYMENT'  as LeadStage, to: 'CLOSED_WON' },
  { from: 'ACTIVE'      as LeadStage, to: 'CLOSED_WON' },
  { from: 'CHURNED'     as LeadStage, to: 'LOST' },
];

export async function POST(request: NextRequest) {
  return withPlatformAccess(async (req) => {
    try {
      // Super admin only
      if (!['QUANTIX_SUPER_ADMIN', 'PLATFORM_ADMIN'].includes(req.user?.role ?? '')) {
        return createErrorResponse('Super admin access required', 403);
      }

      const results: Record<string, number> = {};

      for (const { from, to } of STAGE_MIGRATIONS) {
        const { count } = await db.lead.updateMany({
          where: { stage: from },
          data:  { stage: to },
        });
        results[`${from} → ${to}`] = count;
      }

      const totalMigrated = Object.values(results).reduce((a, b) => a + b, 0);

      return createSuccessResponse({
        message: `Migration complete. ${totalMigrated} lead(s) updated.`,
        details: results,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Migration failed';
      return createErrorResponse(message, 500);
    }
  })(request);
}
