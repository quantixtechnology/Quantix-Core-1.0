// ============================================================================
// QUANTIX CORE — Businesses API
// GET  /api/core/businesses          — List businesses with filtering/pagination
// POST /api/core/businesses          — Create business (Quantix Super Admin only)
//
// BUSINESS MODEL:
//   NO public business creation. Only Quantix team creates businesses manually.
// ============================================================================

import {
  withPlatformAccess,
  createSuccessResponse,
  createPaginatedResponse,
  createErrorResponse,
  getPaginationParams,
} from '@/lib/middleware';
import { createBusiness, listBusinesses } from '@/lib/core/business';
import type { CreateBusinessRequest, BusinessType, BusinessStatus } from '@/lib/core/types';
import type { NextRequest } from 'next/server';

// ============================================================================
// GET /api/core/businesses — List businesses with filtering/pagination
// Available to Quantix team members
// ============================================================================

export async function GET(request: NextRequest) {
  return withPlatformAccess(async (req) => {
    try {
      const { searchParams } = new URL(req.url);

      // Parse pagination
      const { page, limit } = getPaginationParams(req);

      // Parse filters
      const businessTypeParam = searchParams.get('businessType');
      const statusParam = searchParams.get('status');
      const salesRepId = searchParams.get('salesRepId') || undefined;
      const search = searchParams.get('search') || undefined;
      const isOnlineParam = searchParams.get('isOnline');

      const businessType = businessTypeParam
        ? (businessTypeParam.split(',') as BusinessType[])
        : undefined;

      const status = statusParam
        ? (statusParam.split(',') as BusinessStatus[])
        : undefined;

      const isOnline = isOnlineParam !== null ? isOnlineParam === 'true' : undefined;

      const result = await listBusinesses({
        page,
        limit,
        businessType,
        status,
        salesRepId,
        search,
        isOnline,
      });

      return createPaginatedResponse(result.data, {
        page: result.pagination.page,
        limit: result.pagination.limit,
        total: result.pagination.total,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to list businesses';
      return createErrorResponse(message, 500);
    }
  })(request);
}

// ============================================================================
// POST /api/core/businesses — Create business (Quantix team only)
// Business can only be created from a lead that has reached PAYMENT_RECEIVED stage.
// NO self-signup, NO public creation.
// ============================================================================

export async function POST(request: NextRequest) {
  return withPlatformAccess(async (req) => {
    try {
      const body = (await req.json()) as CreateBusinessRequest;

      // Validate required fields
      if (!body.name || !body.slug || !body.businessType) {
        return createErrorResponse(
          'Missing required fields: name, slug, businessType',
          400
        );
      }

      // Validate business type
      const validBusinessTypes: BusinessType[] = [
        'GROCERY', 'FOOD_DELIVERY', 'LAUNDRY', 'CAR_WASH', 'PHARMACY',
        'HOME_SERVICES', 'ECOMMERCE', 'COSMETICS', 'MEAT_DELIVERY',
        'FURNITURE', 'DIRECTORY',
      ];
      if (!validBusinessTypes.includes(body.businessType)) {
        return createErrorResponse(
          `Invalid businessType. Must be one of: ${validBusinessTypes.join(', ')}`,
          400
        );
      }

      if (body.planTier && body.planTier !== 'STANDARD' && body.planTier !== 'PRO') {
        return createErrorResponse('Invalid planTier. Must be STANDARD or PRO', 400);
      }

      // If leadId is provided, verify the lead exists (no stage gate — creation is manual)
      if (body.leadId) {
        const { db } = await import('@/lib/db');
        const lead = await db.lead.findUnique({ where: { id: body.leadId } });
        if (!lead) {
          return createErrorResponse('Lead not found', 404);
        }
      }

      const result = await createBusiness(body);

      return createSuccessResponse(result, 201);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create business';
      const status = message.includes('already exists') || message.includes('not found') ? 409 : 500;
      return createErrorResponse(message, status);
    }
  })(request);
}
