// ============================================================================
// QUANTIX CORE — Single Lead API
// GET    /api/core/leads/[leadId]  — Get lead details (Quantix team only)
// PATCH  /api/core/leads/[leadId]  — Partial update lead (Quantix team only)
// PUT    /api/core/leads/[leadId]  — Full lead update (Quantix team only)
// ============================================================================

import {
  withPlatformAccess,
  createSuccessResponse,
  createErrorResponse,
} from '@/lib/middleware';
import { db } from '@/lib/db';
import type { NextRequest } from 'next/server';
import type { LeadSource, LeadStage, BusinessType } from '@/lib/types';
import type { Business, DemoTenant } from '@prisma/client';

// ============================================================================
// GET /api/core/leads/[leadId] — Get lead details
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  return withPlatformAccess(async (_req) => {
    try {
      const { leadId } = await params;

      const lead = await db.lead.findUnique({
        where: { id: leadId },
        include: {
          salesRep: {
            select: { id: true, name: true, email: true, phone: true },
          },
          assignedToUser: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      if (!lead) {
        return createErrorResponse('Lead not found', 404);
      }

      // If lead has a convertedBusinessId, include basic business info
      let convertedBusiness: Pick<Business, 'id' | 'name' | 'slug' | 'status' | 'businessType'> | null = null;
      if (lead.convertedBusinessId) {
        convertedBusiness = await db.business.findUnique({
          where: { id: lead.convertedBusinessId },
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            businessType: true,
          },
        });
      }

      // If lead has a demoTenantId, include basic demo tenant info
      let demoTenant: Pick<DemoTenant, 'id' | 'name' | 'slug' | 'status' | 'accessUrl' | 'sessionExpiresAt'> | null = null;
      if (lead.demoTenantId) {
        demoTenant = await db.demoTenant.findUnique({
          where: { id: lead.demoTenantId },
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            accessUrl: true,
            sessionExpiresAt: true,
          },
        });
      }

      return createSuccessResponse({
        ...lead,
        convertedBusiness,
        demoTenant,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get lead';
      return createErrorResponse(message, 500);
    }
  })(request);
}

// ============================================================================
// PATCH /api/core/leads/[leadId] — Partial update lead
// ============================================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  return withPlatformAccess(async (req) => {
    try {
      const { leadId } = await params;

      const lead = await db.lead.findUnique({ where: { id: leadId } });
      if (!lead) {
        return createErrorResponse('Lead not found', 404);
      }

      const body = await req.json();

      // Build update data — only include fields that are explicitly provided
      const updateData: Record<string, unknown> = {};

      // Basic fields
      const allowedFields = [
        'businessName', 'contactName', 'contactEmail', 'contactPhone', 'city',
        'notes', 'lostReason', 'demoFeedback', 'negotiationNotes',
        'paymentProof', 'selectedBillingCycle',
      ] as const;

      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          updateData[field] = body[field];
        }
      }

      // Business type
      if (body.businessType !== undefined) {
        const validBusinessTypes: BusinessType[] = [
          'GROCERY', 'FOOD_DELIVERY', 'LAUNDRY', 'CAR_WASH', 'PHARMACY',
          'HOME_SERVICES', 'ECOMMERCE', 'COSMETICS', 'MEAT_DELIVERY',
          'FURNITURE', 'DIRECTORY',
        ];
        if (!validBusinessTypes.includes(body.businessType)) {
          return createErrorResponse('Invalid businessType', 400);
        }
        updateData.businessType = body.businessType;
      }

      // Source
      if (body.source !== undefined) {
        const validSources: LeadSource[] = [
          'META_ADS', 'GOOGLE_ADS', 'DIRECT_REFERRAL', 'WEBSITE_INQUIRY',
          'COLD_OUTREACH', 'WHATSAPP_INQUIRY', 'PHONE_CALL', 'OTHER',
        ];
        if (!validSources.includes(body.source)) {
          return createErrorResponse('Invalid source', 400);
        }
        updateData.source = body.source;
      }

      // Stage — use advance-stage endpoint for proper transitions
      if (body.stage !== undefined) {
        const validStages: LeadStage[] = [
          'LEAD', 'FOLLOW_UP', 'INTERESTED', 'HOT_LEAD',
          'NOT_INTERESTED', 'WRONG_NUMBER', 'RNR',
          'DEMO_PLANNED', 'DEMO_DONE',
          'NEGOTIATION', 'PAYMENT_PENDING', 'PAYMENT_RECEIVED', 'CLOSED_WON',
          'LOST', 'DUPLICATE',
        ];
        if (!validStages.includes(body.stage)) {
          return createErrorResponse('Invalid stage', 400);
        }
        updateData.stage = body.stage;
      }

      // Sales rep assignment
      if (body.salesRepId !== undefined) {
        if (body.salesRepId) {
          const salesRep = await db.salesTeamMember.findUnique({
            where: { id: body.salesRepId },
          });
          if (!salesRep) {
            return createErrorResponse('Sales team member not found', 404);
          }
        }
        updateData.salesRepId = body.salesRepId || null;
      }

      // User assignment (direct User-based ownership)
      if (body.assignedToUserId !== undefined) {
        if (body.assignedToUserId) {
          const assignee = await db.user.findUnique({
            where: { id: body.assignedToUserId },
          });
          if (!assignee || !assignee.isActive) {
            return createErrorResponse('Assigned user not found or inactive', 404);
          }
        }
        updateData.assignedToUserId = body.assignedToUserId || null;
      }

      // Numeric fields
      if (body.estimatedValue !== undefined) {
        updateData.estimatedValue = body.estimatedValue;
      }
      if (body.negotiatedMonthlyPrice !== undefined) {
        updateData.negotiatedMonthlyPrice = body.negotiatedMonthlyPrice;
      }
      if (body.negotiatedYearlyPrice !== undefined) {
        updateData.negotiatedYearlyPrice = body.negotiatedYearlyPrice;
      }

      // Date fields
      if (body.followUpDate !== undefined) {
        updateData.followUpDate = body.followUpDate ? new Date(body.followUpDate) : null;
      }

      // Tags
      if (body.tags !== undefined) {
        updateData.tags = JSON.stringify(body.tags);
      }

      // Demo credentials
      if (body.demoCredentials !== undefined) {
        updateData.demoCredentials = typeof body.demoCredentials === 'string'
          ? body.demoCredentials
          : JSON.stringify(body.demoCredentials);
      }
      if (body.demoTenantId !== undefined) {
        updateData.demoTenantId = body.demoTenantId;
      }
      if (body.demoSharedAt !== undefined) {
        updateData.demoSharedAt = body.demoSharedAt ? new Date(body.demoSharedAt) : null;
      }

      // Payment verification
      if (body.paymentVerifiedAt !== undefined) {
        updateData.paymentVerifiedAt = body.paymentVerifiedAt ? new Date(body.paymentVerifiedAt) : null;
      }
      if (body.paymentVerifiedBy !== undefined) {
        updateData.paymentVerifiedBy = body.paymentVerifiedBy;
      }

      // Last contacted
      if (body.lastContactedAt !== undefined) {
        updateData.lastContactedAt = body.lastContactedAt ? new Date(body.lastContactedAt) : null;
      }

      // Only update if there are fields to update
      if (Object.keys(updateData).length === 0) {
        return createErrorResponse('No fields to update', 400);
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

      return createSuccessResponse(updated);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update lead';
      return createErrorResponse(message, 500);
    }
  })(request);
}

// ============================================================================
// PUT /api/core/leads/[leadId] — Full lead update
// ============================================================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  return withPlatformAccess(async (req) => {
    try {
      const { leadId } = await params;

      const lead = await db.lead.findUnique({ where: { id: leadId } });
      if (!lead) {
        return createErrorResponse('Lead not found', 404);
      }

      const body = await req.json();

      // Validate required fields for full update
      if (!body.businessName || !body.contactName || !body.contactEmail || !body.contactPhone || !body.businessType) {
        return createErrorResponse('Missing required fields: businessName, contactName, contactEmail, contactPhone, businessType', 400);
      }

      const validBusinessTypes: BusinessType[] = [
        'GROCERY', 'FOOD_DELIVERY', 'LAUNDRY', 'CAR_WASH', 'PHARMACY',
        'HOME_SERVICES', 'ECOMMERCE', 'COSMETICS', 'MEAT_DELIVERY',
        'FURNITURE', 'DIRECTORY',
      ];
      if (!validBusinessTypes.includes(body.businessType)) {
        return createErrorResponse('Invalid businessType', 400);
      }

      // Validate assignedToUserId if provided
      if (body.assignedToUserId !== undefined && body.assignedToUserId) {
        const assignee = await db.user.findUnique({
          where: { id: body.assignedToUserId },
        });
        if (!assignee || !assignee.isActive) {
          return createErrorResponse('Assigned user not found or inactive', 404);
        }
      }

      const updated = await db.lead.update({
        where: { id: leadId },
        data: {
          businessName: body.businessName,
          contactName: body.contactName,
          contactEmail: body.contactEmail,
          contactPhone: body.contactPhone,
          city: body.city !== undefined ? body.city : lead.city,
          businessType: body.businessType,
          source: body.source || lead.source,
          stage: body.stage || lead.stage,
          salesRepId: body.salesRepId !== undefined ? body.salesRepId : lead.salesRepId,
          assignedToUserId: body.assignedToUserId !== undefined ? body.assignedToUserId : lead.assignedToUserId,
          notes: body.notes !== undefined ? body.notes : lead.notes,
          followUpDate: body.followUpDate ? new Date(body.followUpDate) : lead.followUpDate,
          estimatedValue: body.estimatedValue !== undefined ? body.estimatedValue : lead.estimatedValue,
          tags: body.tags ? JSON.stringify(body.tags) : lead.tags,
          lostReason: body.lostReason !== undefined ? body.lostReason : lead.lostReason,
          demoFeedback: body.demoFeedback !== undefined ? body.demoFeedback : lead.demoFeedback,
          negotiationNotes: body.negotiationNotes !== undefined ? body.negotiationNotes : lead.negotiationNotes,
          negotiatedMonthlyPrice: body.negotiatedMonthlyPrice !== undefined ? body.negotiatedMonthlyPrice : lead.negotiatedMonthlyPrice,
          negotiatedYearlyPrice: body.negotiatedYearlyPrice !== undefined ? body.negotiatedYearlyPrice : lead.negotiatedYearlyPrice,
          paymentProof: body.paymentProof !== undefined ? body.paymentProof : lead.paymentProof,
          selectedBillingCycle: body.selectedBillingCycle !== undefined ? body.selectedBillingCycle : lead.selectedBillingCycle,
        },
        include: {
          salesRep: {
            select: { id: true, name: true, email: true },
          },
          assignedToUser: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      return createSuccessResponse(updated);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update lead';
      return createErrorResponse(message, 500);
    }
  })(request);
}
