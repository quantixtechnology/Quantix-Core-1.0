// ============================================================================
// QUANTIX CORE — Audit Activity Log API
// GET /api/core/audit — List activity logs with filtering & pagination
//
// Auth required (CLIENT_OWNER or QUANTIX_SUPER_ADMIN only)
// Supports filtering by: businessId, userId, action, entity, dateRange
// Supports pagination: page, limit
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware, getPaginationParams } from '@/lib/middleware';
import { getActivityLogs } from '@/lib/core/audit';
import type { ActivityLogFilters } from '@/lib/core/audit';

export const GET = withMiddleware({
  requireAuth: true,
  requiredRoles: ['CLIENT_OWNER', 'QUANTIX_SUPER_ADMIN'],
})(
  async (req) => {
    try {
      const user = req.user!;
      const { searchParams } = new URL(req.url);

      // Business ID: required param, fall back to user's business context
      const businessId = searchParams.get('businessId') || user.businessId || undefined;

      if (!businessId) {
        return NextResponse.json(
          { success: false, error: 'businessId is required' },
          { status: 400 }
        );
      }

      // Only allow QUANTIX_SUPER_ADMIN to query any business
      // CLIENT_OWNER can only query their own business
      if (user.role === 'CLIENT_OWNER' && user.businessId && user.businessId !== businessId) {
        return NextResponse.json(
          { success: false, error: 'You can only view audit logs for your own business' },
          { status: 403 }
        );
      }

      // Build filters from query params
      const filters: ActivityLogFilters = {};

      const action = searchParams.get('action');
      if (action) filters.action = action;

      const actionPrefix = searchParams.get('actionPrefix');
      if (actionPrefix) filters.actionPrefix = actionPrefix;

      const entity = searchParams.get('entity');
      if (entity) filters.entity = entity;

      const userId = searchParams.get('userId');
      if (userId) filters.userId = userId;

      const dateFrom = searchParams.get('dateFrom');
      if (dateFrom) filters.dateFrom = new Date(dateFrom);

      const dateTo = searchParams.get('dateTo');
      if (dateTo) filters.dateTo = new Date(dateTo);

      // Pagination
      const { page, limit } = getPaginationParams(req);

      const result = await getActivityLogs(businessId, filters, page, limit);

      return NextResponse.json({
        success: true,
        data: result.logs,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages,
          hasNext: result.page < result.totalPages,
          hasPrev: result.page > 1,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch audit logs';
      return NextResponse.json(
        { success: false, error: message },
        { status: 500 }
      );
    }
  }
);
