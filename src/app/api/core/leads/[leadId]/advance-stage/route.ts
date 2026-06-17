// ============================================================================
// QUANTIX CORE — Advance Lead Stage API
// POST /api/core/leads/[leadId]/advance-stage
//
// Sales pipeline state machine — no side effects, no auto business creation.
// Business onboarding is triggered manually after CLOSED_WON.
//
// Pipeline: LEAD → FOLLOW_UP → INTERESTED → HOT_LEAD → DEMO_PLANNED → DEMO_DONE
//           → NEGOTIATION → PAYMENT_PENDING → PAYMENT_RECEIVED → CLOSED_WON
// Terminal: NOT_INTERESTED | WRONG_NUMBER | RNR | LOST | DUPLICATE
// ============================================================================

import {
  withPlatformAccess,
  createSuccessResponse,
  createErrorResponse,
} from '@/lib/middleware';
import { db } from '@/lib/db';
import type { NextRequest } from 'next/server';
import type { LeadStage } from '@/lib/types';

const LEAD_STAGE_ORDER: LeadStage[] = [
  'LEAD',
  'FOLLOW_UP',
  'INTERESTED',
  'HOT_LEAD',
  'DEMO_PLANNED',
  'DEMO_DONE',
  'NEGOTIATION',
  'PAYMENT_PENDING',
  'PAYMENT_RECEIVED',
  'CLOSED_WON',
];

const TERMINAL_STAGES: LeadStage[] = [
  'NOT_INTERESTED',
  'WRONG_NUMBER',
  'RNR',
  'LOST',
  'DUPLICATE',
];

function getStageIndex(stage: LeadStage): number {
  return LEAD_STAGE_ORDER.indexOf(stage);
}

function validateTransition(
  currentStage: LeadStage,
  targetStage: LeadStage
): { valid: boolean; error?: string } {
  // Allow transition to any terminal stage from any non-terminal stage
  if (TERMINAL_STAGES.includes(targetStage)) {
    if (TERMINAL_STAGES.includes(currentStage)) {
      return { valid: false, error: `Lead is already in a terminal stage: ${currentStage}` };
    }
    return { valid: true };
  }

  // Cannot transition out of terminal stages
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
  if (targetIndex <= currentIndex) {
    return { valid: false, error: `Cannot go backwards from ${currentStage} to ${targetStage}` };
  }
  if (targetIndex !== currentIndex + 1) {
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

      const lead = await db.lead.findUnique({ where: { id: leadId } });
      if (!lead) {
        return createErrorResponse('Lead not found', 404);
      }

      const currentStage = lead.stage as LeadStage;

      if (currentStage === targetStage) {
        return createErrorResponse(`Lead is already at stage: ${targetStage}`, 400);
      }

      const transition = validateTransition(currentStage, targetStage);
      if (!transition.valid) {
        return createErrorResponse(transition.error!, 400);
      }

      // ======================================================================
      // Stage-specific data — no side effects, pure state updates
      // ======================================================================

      const updateData: Record<string, unknown> = { stage: targetStage };

      // Capture negotiation notes / prices when entering NEGOTIATION
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

      // Record billing cycle when entering PAYMENT_PENDING
      if (targetStage === 'PAYMENT_PENDING') {
        if (body.selectedBillingCycle) {
          if (!['monthly', 'yearly', 'MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY'].includes(body.selectedBillingCycle)) {
            return createErrorResponse('Invalid selectedBillingCycle', 400);
          }
          updateData.selectedBillingCycle = body.selectedBillingCycle;
        }
      }

      // Mark payment verified when entering PAYMENT_RECEIVED
      if (targetStage === 'PAYMENT_RECEIVED') {
        updateData.paymentVerifiedAt = new Date();
        updateData.paymentVerifiedBy = req.user?.id || null;
        if (body.paymentProof) {
          updateData.paymentProof = body.paymentProof;
        }
        if (body.selectedBillingCycle) {
          updateData.selectedBillingCycle = body.selectedBillingCycle;
        }
      }

      // Mark conversion timestamp when entering CLOSED_WON
      if (targetStage === 'CLOSED_WON') {
        updateData.convertedAt = new Date();
      }

      // Capture reason for terminal stages
      if (TERMINAL_STAGES.includes(targetStage) && body.lostReason) {
        updateData.lostReason = body.lostReason;
      }

      const updated = await db.lead.update({
        where: { id: leadId },
        data: updateData,
        include: {
          salesRep: {
            select: { id: true, name: true, email: true },
          },
          assignedToUser: {
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
