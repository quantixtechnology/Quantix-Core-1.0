// ============================================================================
// QUANTIX CORE — Subscription Pricing Override API
// POST    /api/core/businesses/[businessId]/subscription/override-pricing
//          — Override pricing (Super Admin only)
// DELETE  /api/core/businesses/[businessId]/subscription/override-pricing
//          — Remove pricing override (Super Admin only)
// ============================================================================

import {
  withMiddleware,
  createSuccessResponse,
  createErrorResponse,
} from '@/lib/middleware';
import { db } from '@/lib/db';
import { overrideSubscriptionPricing, removePricingOverride } from '@/lib/core/subscription';
import type { NextRequest } from 'next/server';

// ============================================================================
// POST — Override subscription pricing (Super Admin only)
// Body: { customPrice: number, reason: string }
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  return withMiddleware({
    requireAuth: true,
    requirePlatformAdmin: true,
    requiredRoles: ['QUANTIX_SUPER_ADMIN'],
  })(async (req) => {
    try {
      const { businessId } = await params;

      // Find the business subscription
      const subscription = await db.businessSubscription.findUnique({
        where: { businessId },
        include: { plan: true },
      });

      if (!subscription) {
        return createErrorResponse(
          'No subscription found for this business',
          404
        );
      }

      const body = await req.json();

      // Validate required fields
      if (body.customPrice === undefined || body.customPrice === null) {
        return createErrorResponse('Missing required field: customPrice', 400);
      }
      if (typeof body.customPrice !== 'number' || body.customPrice < 0) {
        return createErrorResponse('customPrice must be a non-negative number', 400);
      }
      if (!body.reason) {
        return createErrorResponse('Missing required field: reason. A reason is required for pricing overrides.', 400);
      }

      // Apply the pricing override
      const result = await overrideSubscriptionPricing({
        subscriptionId: subscription.id,
        customPrice: body.customPrice,
        reason: body.reason,
      });

      if (!result.success) {
        return createErrorResponse(result.error || 'Failed to override pricing', 400);
      }

      // Log activity
      await db.activityLog.create({
        data: {
          businessId,
          action: 'subscription.pricing_override',
          entity: 'BusinessSubscription',
          entityId: subscription.id,
          details: JSON.stringify({
            planPrice: subscription.planPrice,
            previousCustomPrice: subscription.customPrice,
            newCustomPrice: body.customPrice,
            reason: body.reason,
            overriddenBy: req.user?.id,
          }),
        },
      });

      // Fetch updated subscription
      const updated = await db.businessSubscription.findUnique({
        where: { businessId },
        include: { plan: true },
      });

      return createSuccessResponse({
        subscription: updated,
        message: `Pricing overridden to ₹${body.customPrice.toLocaleString('en-IN')} ${subscription.billingCycle === 'YEARLY' ? '/year' : '/month'}`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to override pricing';
      return createErrorResponse(message, 500);
    }
  })(request);
}

// ============================================================================
// DELETE — Remove pricing override (Super Admin only)
// Resets subscription to the standard plan price
// ============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  return withMiddleware({
    requireAuth: true,
    requirePlatformAdmin: true,
    requiredRoles: ['QUANTIX_SUPER_ADMIN'],
  })(async (req) => {
    try {
      const { businessId } = await params;

      // Find the business subscription
      const subscription = await db.businessSubscription.findUnique({
        where: { businessId },
        include: { plan: true },
      });

      if (!subscription) {
        return createErrorResponse(
          'No subscription found for this business',
          404
        );
      }

      // Check if there is actually an override to remove
      if (!subscription.manualPriceOverride) {
        return createErrorResponse(
          'No pricing override exists for this subscription',
          400
        );
      }

      // Remove the pricing override
      const result = await removePricingOverride(subscription.id);

      if (!result.success) {
        return createErrorResponse(result.error || 'Failed to remove pricing override', 400);
      }

      // Log activity
      await db.activityLog.create({
        data: {
          businessId,
          action: 'subscription.pricing_override_removed',
          entity: 'BusinessSubscription',
          entityId: subscription.id,
          details: JSON.stringify({
            previousCustomPrice: subscription.customPrice,
            restoredToPlanPrice: subscription.planPrice,
            removedBy: req.user?.id,
          }),
        },
      });

      // Fetch updated subscription
      const updated = await db.businessSubscription.findUnique({
        where: { businessId },
        include: { plan: true },
      });

      return createSuccessResponse({
        subscription: updated,
        message: `Pricing override removed. Subscription reverted to base price: ₹${(subscription.subscriptionAmount ?? subscription.planPrice ?? 0).toLocaleString('en-IN')} ${subscription.billingCycle === 'YEARLY' ? '/year' : '/month'}`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to remove pricing override';
      return createErrorResponse(message, 500);
    }
  })(request);
}
