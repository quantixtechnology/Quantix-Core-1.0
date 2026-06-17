// ============================================================================
// QUANTIX CORE — Assignable Users API
// GET /api/core/assignable-users
//
// Returns active SalesTeamMember records + platform Users with QUANTIX_SUPER_ADMIN role
// for lead assignment dropdowns. The Super Admin can own leads directly even
// without a SalesTeamMember profile.
// ============================================================================

import {
  withPlatformAccess,
  createSuccessResponse,
  createErrorResponse,
} from '@/lib/middleware';
import { db } from '@/lib/db';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  return withPlatformAccess(async (_req) => {
    try {
      const [salesTeam, platformAdmins] = await Promise.all([
        db.salesTeamMember.findMany({
          where: { isActive: true },
          select: {
            id: true,
            userId: true,
            name: true,
            email: true,
            phone: true,
            region: true,
            designation: true,
          },
          orderBy: { name: 'asc' },
        }),
        db.user.findMany({
          where: {
            platformRole: 'QUANTIX_SUPER_ADMIN',
            isActive: true,
          },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
          orderBy: { name: 'asc' },
        }),
      ]);

      // Shape: combine sales team members + super admins into a unified list
      const formattedSalesTeam = salesTeam.map((m) => ({
        id: m.id,
        userId: m.userId,
        name: m.name,
        email: m.email,
        phone: m.phone,
        region: m.region,
        designation: m.designation,
        type: 'sales_team' as const,
      }));

      const formattedAdmins = platformAdmins.map((u) => ({
        id: u.id,
        userId: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        region: null,
        designation: 'Super Admin',
        type: 'user' as const,
      }));

      return createSuccessResponse({
        salesTeam: formattedSalesTeam,
        admins: formattedAdmins,
        all: [...formattedSalesTeam, ...formattedAdmins],
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch assignable users';
      return createErrorResponse(message, 500);
    }
  })(request);
}
