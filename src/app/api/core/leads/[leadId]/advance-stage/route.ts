// ============================================================================
// QUANTIX CORE — Advance Lead Stage API
// POST /api/core/leads/[leadId]/advance-stage
//
// Validates stage transitions (can only go forward in order).
// Special handling:
//   - DEMO_SHARED: requires demoTenantId
//   - PAYMENT_RECEIVED: triggers business creation readiness
//   - ONBOARDING: creates the Business record
// ============================================================================

import {
  withPlatformAccess,
  createSuccessResponse,
  createErrorResponse,
} from '@/lib/middleware';
import { db } from '@/lib/db';
import type { NextRequest } from 'next/server';
import type { LeadStage, BusinessType } from '@/lib/types';

// ============================================================================
// LEAD STAGE ORDER — defines valid forward transitions
// ============================================================================

const LEAD_STAGE_ORDER: LeadStage[] = [
  'LEAD',
  'DEMO_SHARED',
  'NEGOTIATION',
  'PAYMENT_PENDING',
  'PAYMENT_RECEIVED',
  'ONBOARDING',
  'DEPLOYMENT',
  'ACTIVE',
];

// Terminal / exit stages — can be set from any stage
const TERMINAL_STAGES: LeadStage[] = ['LOST', 'CHURNED'];

/**
 * Get the index of a stage in the ordered pipeline
 */
function getStageIndex(stage: LeadStage): number {
  const idx = LEAD_STAGE_ORDER.indexOf(stage);
  return idx;
}

/**
 * Validate that a stage transition is allowed.
 * Rules:
 *   1. Can always transition to LOST or CHURNED (exit stages)
 *   2. Can only advance forward in the pipeline (currentIndex < targetIndex)
 *   3. Cannot skip stages (targetIndex must be currentIndex + 1)
 *   4. Cannot go backwards
 */
function validateTransition(currentStage: LeadStage, targetStage: LeadStage): { valid: boolean; error?: string } {
  // Allow transition to terminal stages from any non-terminal stage
  if (TERMINAL_STAGES.includes(targetStage)) {
    if (TERMINAL_STAGES.includes(currentStage)) {
      return { valid: false, error: `Lead is already in terminal stage: ${currentStage}` };
    }
    return { valid: true };
  }

  // Cannot transition from terminal stages
  if (TERMINAL_STAGES.includes(currentStage)) {
    return { valid: false, error: `Cannot advance from terminal stage: ${currentStage}` };
  }

  const currentIndex = getStageIndex(currentStage);
  const targetIndex = getStageIndex(targetStage);

  if (currentIndex === -1) {
    return { valid: false, error: `Invalid current stage: ${currentStage}` };
  }

  if (targetIndex === -1) {
    return { valid: false, error: `Invalid target stage: ${targetStage}` };
  }

  // Can only advance to the next stage (one step at a time)
  if (targetIndex !== currentIndex + 1) {
    if (targetIndex <= currentIndex) {
      return { valid: false, error: `Cannot go backwards from ${currentStage} to ${targetStage}` };
    }
    return {
      valid: false,
      error: `Cannot skip stages. Next valid stage after ${currentStage} is ${LEAD_STAGE_ORDER[currentIndex + 1]}`,
    };
  }

  return { valid: true };
}

// ============================================================================
// POST /api/core/leads/[leadId]/advance-stage
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  return withPlatformAccess(async (req) => {
    try {
      const { leadId } = await params;
      const body = await req.json();

      // Validate target stage
      if (!body.stage) {
        return createErrorResponse('Missing required field: stage', 400);
      }

      const targetStage = body.stage as LeadStage;
      const allValidStages: LeadStage[] = [...LEAD_STAGE_ORDER, ...TERMINAL_STAGES];
      if (!allValidStages.includes(targetStage)) {
        return createErrorResponse(
          `Invalid stage. Must be one of: ${allValidStages.join(', ')}`,
          400
        );
      }

      // Fetch lead
      const lead = await db.lead.findUnique({ where: { id: leadId } });
      if (!lead) {
        return createErrorResponse('Lead not found', 404);
      }

      const currentStage = lead.stage as LeadStage;

      // Already at target
      if (currentStage === targetStage) {
        return createErrorResponse(`Lead is already at stage: ${targetStage}`, 400);
      }

      // Validate transition
      const transition = validateTransition(currentStage, targetStage);
      if (!transition.valid) {
        return createErrorResponse(transition.error!, 400);
      }

      // ====================================================================
      // Stage-specific validation and side effects
      // ====================================================================

      const updateData: Record<string, unknown> = {
        stage: targetStage,
      };

      // When advancing to DEMO_SHARED: requires demoTenantId
      if (targetStage === 'DEMO_SHARED') {
        if (!body.demoTenantId) {
          return createErrorResponse(
            'demoTenantId is required when advancing to DEMO_SHARED stage',
            400
          );
        }

        // Verify demo tenant exists and is available/in use
        const demoTenant = await db.demoTenant.findUnique({
          where: { id: body.demoTenantId },
        });

        if (!demoTenant) {
          return createErrorResponse('Demo tenant not found', 404);
        }

        if (demoTenant.status === 'DISABLED' || demoTenant.status === 'MAINTENANCE') {
          return createErrorResponse(
            `Demo tenant is not available (status: ${demoTenant.status})`,
            400
          );
        }

        // Assign demo tenant to this lead
        updateData.demoTenantId = body.demoTenantId;
        updateData.demoSharedAt = new Date();

        // Update demo tenant status
        await db.demoTenant.update({
          where: { id: body.demoTenantId },
          data: {
            status: 'IN_USE',
            currentLeadId: leadId,
            currentLeadName: lead.businessName,
            sessionStartedAt: new Date(),
            sessionExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
          },
        });
      }

      // When advancing to NEGOTIATION: capture negotiated prices if provided
      if (targetStage === 'NEGOTIATION') {
        if (body.negotiatedMonthlyPrice !== undefined) {
          updateData.negotiatedMonthlyPrice = body.negotiatedMonthlyPrice;
        }
        if (body.negotiatedYearlyPrice !== undefined) {
          updateData.negotiatedYearlyPrice = body.negotiatedYearlyPrice;
        }
        if (body.negotiationNotes) {
          updateData.negotiationNotes = body.negotiationNotes;
        }
      }

      // When advancing to PAYMENT_PENDING: record billing cycle selection
      if (targetStage === 'PAYMENT_PENDING') {
        if (body.selectedBillingCycle) {
          if (!['monthly', 'yearly'].includes(body.selectedBillingCycle)) {
            return createErrorResponse('selectedBillingCycle must be "monthly" or "yearly"', 400);
          }
          updateData.selectedBillingCycle = body.selectedBillingCycle;
        }
      }

      // When advancing to PAYMENT_RECEIVED: mark payment as verified
      if (targetStage === 'PAYMENT_RECEIVED') {
        updateData.paymentVerifiedAt = new Date();
        updateData.paymentVerifiedBy = req.user?.id || null;

        if (body.paymentProof) {
          updateData.paymentProof = body.paymentProof;
        }
        // Ensure billing cycle is set
        if (!lead.selectedBillingCycle && !body.selectedBillingCycle) {
          return createErrorResponse(
            'selectedBillingCycle is required when advancing to PAYMENT_RECEIVED. Set it at PAYMENT_PENDING or provide it now.',
            400
          );
        }
        if (body.selectedBillingCycle) {
          updateData.selectedBillingCycle = body.selectedBillingCycle;
        }
      }

      // When advancing to ONBOARDING: create the Business record
      if (targetStage === 'ONBOARDING') {
        // The lead must have payment verified
        if (!lead.paymentVerifiedAt) {
          return createErrorResponse(
            'Payment must be verified before onboarding. Advance to PAYMENT_RECEIVED first.',
            400
          );
        }

        // Check if business already created for this lead
        if (lead.convertedBusinessId) {
          // Business already exists, just advance the stage
        } else {
          // Create the business from the lead
          const billingCycle = (lead.selectedBillingCycle || 'monthly') as 'monthly' | 'yearly';
          const planBillingCycle = billingCycle === 'yearly' ? 'YEARLY' : 'MONTHLY';

          // Find the appropriate platform plan
          const plan = await db.platformPlan.findUnique({
            where: { billingCycle: planBillingCycle },
          });

          if (!plan) {
            return createErrorResponse(
              `Platform plan for ${planBillingCycle} billing not found. Please seed plans first.`,
              500
            );
          }

          // Generate slug from business name
          const slug = lead.businessName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');

          // Check slug uniqueness
          const existingBusiness = await db.business.findUnique({ where: { slug } });
          if (existingBusiness) {
            return createErrorResponse(
              `Business with slug "${slug}" already exists. Cannot auto-create business.`,
              409
            );
          }

          // Determine pricing — use negotiated prices if available
          const customPrice = billingCycle === 'yearly'
            ? lead.negotiatedYearlyPrice
            : lead.negotiatedMonthlyPrice;

          // Create business using the core library
          const { createBusiness } = await import('@/lib/core/business');
          const business = await createBusiness({
            name: lead.businessName,
            slug,
            businessType: lead.businessType as BusinessType,
            contactEmail: lead.contactEmail,
            contactPhone: lead.contactPhone,
            planId: plan.id,
            billingCycle: planBillingCycle,
            customPrice: customPrice || undefined,
            overrideReason: customPrice ? 'Negotiated pricing from lead' : undefined,
            leadId: leadId,
            salesRepId: lead.salesRepId || undefined,
          });

          updateData.convertedBusinessId = business.id;
          updateData.convertedAt = new Date();
        }
      }

      // When advancing to DEPLOYMENT: no extra validation needed
      if (targetStage === 'DEPLOYMENT') {
        if (!lead.convertedBusinessId) {
          return createErrorResponse(
            'Lead must have a converted business before deployment. Advance to ONBOARDING first.',
            400
          );
        }
      }

      // When advancing to ACTIVE: mark conversion complete
      if (targetStage === 'ACTIVE') {
        updateData.convertedAt = updateData.convertedAt || lead.convertedAt || new Date();
      }

      // When marking as LOST: capture reason
      if (targetStage === 'LOST') {
        if (!body.lostReason) {
          return createErrorResponse('lostReason is required when marking a lead as LOST', 400);
        }
        updateData.lostReason = body.lostReason;
      }

      // When marking as CHURNED: capture reason
      if (targetStage === 'CHURNED') {
        if (!body.lostReason) {
          return createErrorResponse('lostReason is required when marking a lead as CHURNED', 400);
        }
        updateData.lostReason = body.lostReason;

        // If business exists, update its status
        if (lead.convertedBusinessId) {
          await db.business.update({
            where: { id: lead.convertedBusinessId },
            data: { status: 'CHURNED', isOnline: false },
          });
        }
      }

      // Update the lead
      const updated = await db.lead.update({
        where: { id: leadId },
        data: updateData,
        include: {
          salesRep: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      return createSuccessResponse({
        lead: updated,
        previousStage: currentStage,
        newStage: targetStage,
        message: `Lead advanced from ${currentStage} to ${targetStage}`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to advance lead stage';
      return createErrorResponse(message, 500);
    }
  })(request);
}
