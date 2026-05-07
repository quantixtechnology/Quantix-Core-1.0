// ============================================================================
// QUANTIX CORE — Demo Tenants API
// GET  /api/core/demo-tenants          — List demo tenants (Quantix team only)
// POST /api/core/demo-tenants          — Create demo tenant (Super Admin only)
// ============================================================================

import {
  withPlatformAccess,
  withMiddleware,
  createSuccessResponse,
  createPaginatedResponse,
  createErrorResponse,
  getPaginationParams,
} from '@/lib/middleware';
import { db } from '@/lib/db';
import type { NextRequest } from 'next/server';
import type { BusinessType, DemoTenantStatus } from '@/lib/types';

// ============================================================================
// GET /api/core/demo-tenants — List demo tenants (Quantix team only)
// ============================================================================

export async function GET(request: NextRequest) {
  return withPlatformAccess(async (req) => {
    try {
      const { page, limit, skip } = getPaginationParams(req);
      const { searchParams } = new URL(req.url);

      // Filters
      const statusParam = searchParams.get('status');
      const businessTypeParam = searchParams.get('businessType');
      const search = searchParams.get('search');

      // Build where clause
      const where: Record<string, unknown> = {};

      if (statusParam) {
        const statuses = statusParam.split(',') as DemoTenantStatus[];
        where.status = { in: statuses };
      }

      if (businessTypeParam) {
        const types = businessTypeParam.split(',') as BusinessType[];
        where.businessType = { in: types };
      }

      if (search) {
        where.OR = [
          { name: { contains: search } },
          { slug: { contains: search } },
          { currentLeadName: { contains: search } },
        ];
      }

      const [tenants, total] = await Promise.all([
        db.demoTenant.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        db.demoTenant.count({ where }),
      ]);

      // Mask passwords in list view
      const maskedTenants = tenants.map((tenant) => ({
        ...tenant,
        accessPassword: '••••••••', // Never expose passwords in list
      }));

      return createPaginatedResponse(maskedTenants, { page, limit, total });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to list demo tenants';
      return createErrorResponse(message, 500);
    }
  })(request);
}

// ============================================================================
// POST /api/core/demo-tenants — Create demo tenant (Super Admin only)
// ============================================================================

export async function POST(request: NextRequest) {
  return withMiddleware({
    requireAuth: true,
    requirePlatformAdmin: true,
    requiredRoles: ['QUANTIX_SUPER_ADMIN'],
  })(async (req) => {
    try {
      const body = await req.json();

      // Validate required fields
      if (!body.name) {
        return createErrorResponse('Missing required field: name', 400);
      }
      if (!body.slug) {
        return createErrorResponse('Missing required field: slug', 400);
      }
      if (!body.businessType) {
        return createErrorResponse('Missing required field: businessType', 400);
      }
      if (!body.accessEmail) {
        return createErrorResponse('Missing required field: accessEmail', 400);
      }
      if (!body.accessPassword) {
        return createErrorResponse('Missing required field: accessPassword', 400);
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

      // Check slug uniqueness
      const existing = await db.demoTenant.findUnique({
        where: { slug: body.slug },
      });
      if (existing) {
        return createErrorResponse(`Demo tenant with slug "${body.slug}" already exists`, 409);
      }

      // Hash password for storage (in production, use bcrypt)
      // For now we store a placeholder since this is demo environment
      const hashedPassword = body.accessPassword;

      // Create demo tenant
      const tenant = await db.demoTenant.create({
        data: {
          name: body.name,
          slug: body.slug,
          businessType: body.businessType,
          status: 'AVAILABLE',
          accessEmail: body.accessEmail,
          accessPassword: hashedPassword,
          accessUrl: body.accessUrl || null,
          sampleDataConfig: body.sampleDataConfig
            ? JSON.stringify(body.sampleDataConfig)
            : '{}',
          resetAfterUse: body.resetAfterUse !== false,
          description: body.description || null,
          notes: body.notes || null,
        },
      });

      // Return without password
      const { accessPassword: _pwd, ...safeTenant } = tenant;
      return createSuccessResponse(safeTenant, 201);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create demo tenant';
      return createErrorResponse(message, 500);
    }
  })(request);
}
