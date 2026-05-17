// ============================================================================
// Route: GET/PUT /api/core/platform/plans/[planId]
// GET — Get single platform plan (platform admin)
// PUT — Update platform plan (QUANTIX_SUPER_ADMIN only)
// ============================================================================

import { db } from '@/lib/db';
import { withPlatformAccess, createSuccessResponse, createErrorResponse } from '@/lib/middleware';
import type { NextRequest } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ planId: string }> }
) {
  return withPlatformAccess(async (_req) => {
    try {
      const { planId } = await params;

      const plan = await db.platformPlan.findUnique({ where: { id: planId } });
      if (!plan) return createErrorResponse('Plan not found', 404);

      return createSuccessResponse({ ...plan, features: JSON.parse(plan.features) });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch plan';
      return createErrorResponse(message, 500);
    }
  })(request);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ planId: string }> }
) {
  return withPlatformAccess(async (req) => {
    try {
      if (req.user?.role !== 'QUANTIX_SUPER_ADMIN') {
        return createErrorResponse('Only QUANTIX_SUPER_ADMIN can update plans', 403);
      }

      const { planId } = await params;
      const body = await req.json();

      const existing = await db.platformPlan.findUnique({ where: { id: planId } });
      if (!existing) return createErrorResponse('Plan not found', 404);

      const updateData: Record<string, unknown> = {};
      const allowedFields = [
        'name', 'description',
        'maxStores', 'maxProducts', 'maxOrders', 'maxDeliveryPartners', 'maxStaff',
        'hasPOS', 'hasDelivery', 'hasSubscription', 'hasCustomDomain',
        'hasWhiteLabel', 'hasAdvancedReports', 'hasAPIAccess',
        'hasEcommerceWorkflow', 'hasPickupWorkflow', 'hasAppointmentWorkflow',
        'hasSubscriptionWorkflow', 'hasPostServiceWorkflow', 'hasAdvancedWorkflowEngine',
        'isActive',
      ];

      for (const field of allowedFields) {
        if (body[field] !== undefined) updateData[field] = body[field];
      }

      if (body.features !== undefined) {
        updateData.features = typeof body.features === 'string' ? body.features : JSON.stringify(body.features);
      }

      if (Object.keys(updateData).length === 0) {
        return createErrorResponse('No valid fields to update', 400);
      }

      const updated = await db.platformPlan.update({ where: { id: planId }, data: updateData });
      return createSuccessResponse({ ...updated, features: JSON.parse(updated.features) });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update plan';
      return createErrorResponse(message, 500);
    }
  })(request);
}
