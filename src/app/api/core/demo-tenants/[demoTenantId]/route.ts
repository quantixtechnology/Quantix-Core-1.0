// ============================================================================
// QUANTIX CORE — Single Demo Tenant API
// GET    /api/core/demo-tenants/[demoTenantId]  — Get demo tenant (Quantix team)
// PATCH  /api/core/demo-tenants/[demoTenantId]  — Update demo tenant
// POST   /api/core/demo-tenants/[demoTenantId]  — Actions: reset, assign to lead
// ============================================================================

import {
  withPlatformAccess,
  withMiddleware,
  createSuccessResponse,
  createErrorResponse,
} from '@/lib/middleware';
import { db } from '@/lib/db';
import type { NextRequest } from 'next/server';
import type { DemoTenantStatus, BusinessType } from '@/lib/types';

// ============================================================================
// GET /api/core/demo-tenants/[demoTenantId] — Get demo tenant details
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ demoTenantId: string }> }
) {
  return withPlatformAccess(async (_req) => {
    try {
      const { demoTenantId } = await params;

      const tenant = await db.demoTenant.findUnique({
        where: { id: demoTenantId },
      });

      if (!tenant) {
        return createErrorResponse('Demo tenant not found', 404);
      }

      // Include lead info if currently assigned
      let currentLead = null;
      if (tenant.currentLeadId) {
        currentLead = await db.lead.findUnique({
          where: { id: tenant.currentLeadId },
          select: {
            id: true,
            businessName: true,
            contactName: true,
            contactEmail: true,
            stage: true,
          },
        });
      }

      return createSuccessResponse({
        ...tenant,
        currentLead,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get demo tenant';
      return createErrorResponse(message, 500);
    }
  })(request);
}

// ============================================================================
// PATCH /api/core/demo-tenants/[demoTenantId] — Update demo tenant
// ============================================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ demoTenantId: string }> }
) {
  return withPlatformAccess(async (req) => {
    try {
      const { demoTenantId } = await params;

      const tenant = await db.demoTenant.findUnique({
        where: { id: demoTenantId },
      });
      if (!tenant) {
        return createErrorResponse('Demo tenant not found', 404);
      }

      const body = await req.json();

      // Build update data
      const updateData: Record<string, unknown> = {};

      // Basic string fields
      const allowedFields = [
        'name', 'accessEmail', 'accessUrl', 'description', 'notes',
      ] as const;

      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          updateData[field] = body[field];
        }
      }

      // Status update
      if (body.status !== undefined) {
        const validStatuses: DemoTenantStatus[] = ['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'DISABLED'];
        if (!validStatuses.includes(body.status)) {
          return createErrorResponse(`Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400);
        }
        updateData.status = body.status;

        // If setting back to AVAILABLE, clear current lead
        if (body.status === 'AVAILABLE') {
          updateData.currentLeadId = null;
          updateData.currentLeadName = null;
          updateData.sessionStartedAt = null;
          updateData.sessionExpiresAt = null;
        }
      }

      // Password update (Super Admin only)
      if (body.accessPassword !== undefined) {
        if (req.user?.role !== 'QUANTIX_SUPER_ADMIN') {
          return createErrorResponse('Only Super Admin can update demo tenant credentials', 403);
        }
        updateData.accessPassword = body.accessPassword;
      }

      // Sample data config
      if (body.sampleDataConfig !== undefined) {
        updateData.sampleDataConfig = typeof body.sampleDataConfig === 'string'
          ? body.sampleDataConfig
          : JSON.stringify(body.sampleDataConfig);
      }

      // Reset after use
      if (body.resetAfterUse !== undefined) {
        updateData.resetAfterUse = body.resetAfterUse;
      }

      // Session management
      if (body.sessionExpiresAt !== undefined) {
        updateData.sessionExpiresAt = body.sessionExpiresAt ? new Date(body.sessionExpiresAt) : null;
      }

      if (Object.keys(updateData).length === 0) {
        return createErrorResponse('No fields to update', 400);
      }

      const updated = await db.demoTenant.update({
        where: { id: demoTenantId },
        data: updateData,
      });

      // Mask password in response
      const { accessPassword: _pwd, ...safeTenant } = updated;
      return createSuccessResponse(safeTenant);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update demo tenant';
      return createErrorResponse(message, 500);
    }
  })(request);
}

// ============================================================================
// POST /api/core/demo-tenants/[demoTenantId] — Actions
// Body: { action: "reset" | "assign", leadId?: string }
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ demoTenantId: string }> }
) {
  return withMiddleware({
    requireAuth: true,
    requirePlatformAdmin: true,
    requiredRoles: ['QUANTIX_SUPER_ADMIN', 'QUANTIX_SALES_TEAM'],
  })(async (req) => {
    try {
      const { demoTenantId } = await params;

      const tenant = await db.demoTenant.findUnique({
        where: { id: demoTenantId },
      });
      if (!tenant) {
        return createErrorResponse('Demo tenant not found', 404);
      }

      const body = await req.json();

      if (!body.action) {
        return createErrorResponse('Missing required field: action. Valid actions: "reset", "assign"', 400);
      }

      switch (body.action) {
        // ====================================================================
        // RESET — Reset demo tenant to AVAILABLE state
        // ====================================================================
        case 'reset': {
          // Clear current lead association
          const updated = await db.demoTenant.update({
            where: { id: demoTenantId },
            data: {
              status: 'AVAILABLE',
              currentLeadId: null,
              currentLeadName: null,
              sessionStartedAt: null,
              sessionExpiresAt: null,
              lastResetAt: new Date(),
            },
          });

          // Also update the lead's demo info if it was linked
          if (tenant.currentLeadId) {
            await db.lead.updateMany({
              where: {
                id: tenant.currentLeadId,
                demoTenantId: demoTenantId,
              },
              data: {
                demoTenantId: null,
                demoSharedAt: null,
              },
            });
          }

          const { accessPassword: _pwd, ...safeTenant } = updated;
          return createSuccessResponse({
            ...safeTenant,
            message: 'Demo tenant has been reset and is now available',
          });
        }

        // ====================================================================
        // ASSIGN — Assign demo tenant to a lead
        // ====================================================================
        case 'assign': {
          if (!body.leadId) {
            return createErrorResponse('leadId is required for assign action', 400);
          }

          // Verify lead exists
          const lead = await db.lead.findUnique({
            where: { id: body.leadId },
          });
          if (!lead) {
            return createErrorResponse('Lead not found', 404);
          }

          // Check if tenant is available
          if (tenant.status === 'DISABLED' || tenant.status === 'MAINTENANCE') {
            return createErrorResponse(
              `Cannot assign demo tenant. Current status: ${tenant.status}`,
              400
            );
          }

          // If tenant is already in use, check if session has expired
          if (tenant.status === 'IN_USE' && tenant.sessionExpiresAt) {
            if (new Date() < tenant.sessionExpiresAt) {
              return createErrorResponse(
                'Demo tenant is currently in use. Wait for session to expire or reset first.',
                400
              );
            }
          }

          // Assign tenant to lead
          const sessionDuration = body.sessionDurationDays || 7;
          const updated = await db.demoTenant.update({
            where: { id: demoTenantId },
            data: {
              status: 'IN_USE',
              currentLeadId: body.leadId,
              currentLeadName: lead.businessName,
              sessionStartedAt: new Date(),
              sessionExpiresAt: new Date(Date.now() + sessionDuration * 24 * 60 * 60 * 1000),
            },
          });

          // Update lead with demo tenant info
          await db.lead.update({
            where: { id: body.leadId },
            data: {
              demoTenantId: demoTenantId,
              demoSharedAt: new Date(),
              demoCredentials: JSON.stringify({
                email: tenant.accessEmail,
                url: tenant.accessUrl,
              }),
            },
          });

          const { accessPassword: _pwd, ...safeTenant } = updated;
          return createSuccessResponse({
            ...safeTenant,
            message: `Demo tenant assigned to lead "${lead.businessName}"`,
            accessCredentials: {
              email: tenant.accessEmail,
              password: tenant.accessPassword, // Expose password on assign for sharing
              url: tenant.accessUrl,
            },
          });
        }

        default:
          return createErrorResponse(`Invalid action: "${body.action}". Valid actions: "reset", "assign"`, 400);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to perform action on demo tenant';
      return createErrorResponse(message, 500);
    }
  })(request);
}
