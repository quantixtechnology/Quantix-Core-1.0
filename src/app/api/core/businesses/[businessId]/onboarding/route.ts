// ============================================================================
// QUANTIX CORE — Business Onboarding API
// GET    /api/core/businesses/[businessId]/onboarding  — Get onboarding progress
// PATCH  /api/core/businesses/[businessId]/onboarding  — Update onboarding step status
// ============================================================================

import {
  withAuth,
  createSuccessResponse,
  createErrorResponse,
} from '@/lib/middleware';
import { db } from '@/lib/db';
import type { NextRequest } from 'next/server';
import type { OnboardingStepStatus } from '@/lib/types';

// ============================================================================
// GET /api/core/businesses/[businessId]/onboarding — Get onboarding progress
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  return withAuth(async (_req) => {
    try {
      const { businessId } = await params;

      // Verify business exists
      const business = await db.business.findUnique({
        where: { id: businessId },
      });
      if (!business) {
        return createErrorResponse('Business not found', 404);
      }

      // Get onboarding steps
      const steps = await db.onboardingStep.findMany({
        where: { businessId },
        orderBy: { sortOrder: 'asc' },
      });

      const totalSteps = steps.length;
      const completedSteps = steps.filter((s) => s.status === 'COMPLETED').length;
      const currentStep = steps.find(
        (s) => s.status === 'PENDING' || s.status === 'IN_PROGRESS'
      ) || null;
      const progress = totalSteps > 0
        ? Math.round((completedSteps / totalSteps) * 100)
        : 0;

      const allCompleted = totalSteps > 0 && completedSteps === totalSteps;

      return createSuccessResponse({
        businessId,
        businessName: business.name,
        businessStatus: business.status,
        totalSteps,
        completedSteps,
        currentStep: currentStep
          ? {
              stepKey: currentStep.stepKey,
              stepName: currentStep.stepName,
              status: currentStep.status,
            }
          : null,
        progress,
        allCompleted,
        steps: steps.map((s) => ({
          id: s.id,
          stepKey: s.stepKey,
          stepName: s.stepName,
          status: s.status,
          completedBy: s.completedBy,
          completedAt: s.completedAt,
          notes: s.notes,
          sortOrder: s.sortOrder,
        })),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get onboarding progress';
      return createErrorResponse(message, 500);
    }
  })(request);
}

// ============================================================================
// PATCH /api/core/businesses/[businessId]/onboarding — Update onboarding step
// Body: { stepKey: string, status: OnboardingStepStatus, notes?: string }
// ============================================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  return withAuth(async (req) => {
    try {
      const { businessId } = await params;

      // Verify business exists
      const business = await db.business.findUnique({
        where: { id: businessId },
      });
      if (!business) {
        return createErrorResponse('Business not found', 404);
      }

      // Only allow updates if business is in ONBOARDING status (or platform admin)
      if (business.status !== 'ONBOARDING' && !req.user?.isPlatformAdmin) {
        return createErrorResponse(
          'Onboarding steps can only be updated when business is in ONBOARDING status',
          400
        );
      }

      const body = await req.json();

      // Validate required fields
      if (!body.stepKey) {
        return createErrorResponse('Missing required field: stepKey', 400);
      }
      if (!body.status) {
        return createErrorResponse('Missing required field: status', 400);
      }

      // Validate status
      const validStatuses: OnboardingStepStatus[] = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED'];
      if (!validStatuses.includes(body.status)) {
        return createErrorResponse(
          `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
          400
        );
      }

      // Find the onboarding step
      const step = await db.onboardingStep.findFirst({
        where: { businessId, stepKey: body.stepKey },
      });

      if (!step) {
        return createErrorResponse(
          `Onboarding step "${body.stepKey}" not found for this business`,
          404
        );
      }

      // Update the step
      const updateData: Record<string, unknown> = {
        status: body.status,
        completedBy: body.status === 'COMPLETED' ? (req.user?.id || null) : null,
        completedAt: body.status === 'COMPLETED' ? new Date() : null,
      };

      if (body.notes !== undefined) {
        updateData.notes = body.notes;
      }

      const updatedStep = await db.onboardingStep.update({
        where: { id: step.id },
        data: updateData,
      });

      // Check if all steps are now completed
      const allSteps = await db.onboardingStep.findMany({
        where: { businessId },
      });
      const allCompleted = allSteps.every((s) => s.status === 'COMPLETED' || s.status === 'SKIPPED');
      const completedCount = allSteps.filter((s) => s.status === 'COMPLETED').length;
      const progress = allSteps.length > 0
        ? Math.round((completedCount / allSteps.length) * 100)
        : 0;

      // Log activity
      await db.activityLog.create({
        data: {
          businessId,
          action: 'onboarding.step_updated',
          entity: 'OnboardingStep',
          entityId: updatedStep.id,
          details: JSON.stringify({
            stepKey: body.stepKey,
            status: body.status,
            updatedBy: req.user?.id,
          }),
        },
      });

      return createSuccessResponse({
        step: updatedStep,
        progress: {
          totalSteps: allSteps.length,
          completedSteps: completedCount,
          progress,
          allCompleted,
        },
        message: allCompleted
          ? 'All onboarding steps completed! Business is ready for activation.'
          : `Step "${body.stepKey}" updated to ${body.status}`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update onboarding step';
      return createErrorResponse(message, 500);
    }
  })(request);
}
