// ============================================================================
// QUANTIX CORE — Leads API
// GET  /api/core/leads          — List leads with filtering/pagination (Quantix team only)
// POST /api/core/leads          — Create lead (Quantix team only)
// ============================================================================

import {
  withPlatformAccess,
  createSuccessResponse,
  createPaginatedResponse,
  createErrorResponse,
  getPaginationParams,
} from '@/lib/middleware';
import { db } from '@/lib/db';
import { generateLeadId } from '@/lib/lead-id';
import type { NextRequest } from 'next/server';
import type { LeadSource, LeadStage, BusinessType } from '@/lib/types';

// ============================================================================
// LEAD STAGE ORDER — for pipeline ordering
// ============================================================================

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

// ============================================================================
// GET /api/core/leads — List leads (Quantix team only)
// ============================================================================

export async function GET(request: NextRequest) {
  return withPlatformAccess(async (req) => {
    try {
      const { page, limit, skip } = getPaginationParams(req);
      const { searchParams } = new URL(req.url);

      // Filters
      const stageParam = searchParams.get('stage');
      const sourceParam = searchParams.get('source');
      const salesRepId = searchParams.get('salesRepId');
      const businessTypeParam = searchParams.get('businessType');
      const search = searchParams.get('search');
      const dateFrom = searchParams.get('dateFrom');
      const dateTo = searchParams.get('dateTo');

      // Build where clause
      const where: Record<string, unknown> = {};

      if (stageParam) {
        const stages = stageParam.split(',') as LeadStage[];
        where.stage = { in: stages };
      }

      if (sourceParam) {
        const sources = sourceParam.split(',') as LeadSource[];
        where.source = { in: sources };
      }

      if (salesRepId) {
        where.salesRepId = salesRepId;
      }

      if (businessTypeParam) {
        const types = businessTypeParam.split(',') as BusinessType[];
        where.businessType = { in: types };
      }

      if (search) {
        where.OR = [
          { businessName: { contains: search } },
          { contactName: { contains: search } },
          { contactEmail: { contains: search } },
          { contactPhone: { contains: search } },
        ];
      }

      if (dateFrom || dateTo) {
        const createdAt: Record<string, Date> = {};
        if (dateFrom) createdAt.gte = new Date(dateFrom);
        if (dateTo) createdAt.lte = new Date(dateTo);
        where.createdAt = createdAt;
      }

      const [leads, total] = await Promise.all([
        db.lead.findMany({
          where,
          skip,
          take: limit,
          include: {
            salesRep: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        db.lead.count({ where }),
      ]);

      return createPaginatedResponse(leads, { page, limit, total });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to list leads';
      return createErrorResponse(message, 500);
    }
  })(request);
}

// ============================================================================
// POST /api/core/leads — Create lead (Quantix team only)
// ============================================================================

export async function POST(request: NextRequest) {
  return withPlatformAccess(async (req) => {
    try {
      const body = await req.json();

      // Validate required fields
      if (!body.businessName) {
        return createErrorResponse('Missing required field: businessName', 400);
      }
      if (!body.contactName) {
        return createErrorResponse('Missing required field: contactName', 400);
      }
      if (!body.contactEmail) {
        return createErrorResponse('Missing required field: contactEmail', 400);
      }
      if (!body.contactPhone) {
        return createErrorResponse('Missing required field: contactPhone', 400);
      }
      if (!body.businessType) {
        return createErrorResponse('Missing required field: businessType', 400);
      }

      // Validate businessType
      const validBusinessTypes: BusinessType[] = [
        'GROCERY', 'FOOD_DELIVERY', 'LAUNDRY', 'CAR_WASH', 'PHARMACY',
        'HOME_SERVICES', 'ECOMMERCE', 'COSMETICS', 'MEAT_DELIVERY',
        'FURNITURE', 'DIRECTORY',
      ];
      if (!validBusinessTypes.includes(body.businessType)) {
        return createErrorResponse(`Invalid businessType. Must be one of: ${validBusinessTypes.join(', ')}`, 400);
      }

      // Validate source if provided
      const validSources: LeadSource[] = [
        'META_ADS', 'GOOGLE_ADS', 'DIRECT_REFERRAL', 'WEBSITE_INQUIRY',
        'COLD_OUTREACH', 'WHATSAPP_INQUIRY', 'PHONE_CALL', 'OTHER',
      ];
      if (body.source && !validSources.includes(body.source)) {
        return createErrorResponse(`Invalid source. Must be one of: ${validSources.join(', ')}`, 400);
      }

      // Validate salesRepId if provided
      if (body.salesRepId) {
        const salesRep = await db.salesTeamMember.findUnique({
          where: { id: body.salesRepId },
        });
        if (!salesRep) {
          return createErrorResponse('Sales team member not found', 404);
        }
      }

      // Generate immutable human-readable Lead ID
      const leadId = await generateLeadId(db);

      // Create lead — always starts at LEAD stage
      const lead = await db.lead.create({
        data: {
          leadId,
          businessName: body.businessName,
          contactName: body.contactName,
          contactEmail: body.contactEmail,
          contactPhone: body.contactPhone,
          city: body.city || null,
          state: body.state || null,
          pincode: body.pincode || null,
          businessType: body.businessType,
          source: body.source || 'WEBSITE_INQUIRY',
          stage: 'LEAD',
          salesRepId: body.salesRepId || null,
          createdById: req.user?.id || null,
          notes: body.notes || null,
          followUpDate: body.followUpDate ? new Date(body.followUpDate) : null,
          estimatedValue: body.estimatedValue || null,
          tags: body.tags ? JSON.stringify(body.tags) : '[]',
        },
        include: {
          salesRep: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      return createSuccessResponse(lead, 201);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create lead';
      return createErrorResponse(message, 500);
    }
  })(request);
}
