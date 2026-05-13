// ============================================================================
// Route: GET/POST/PATCH/DELETE /api/admin/sales-team
// GET    — Returns active sales team members
// POST   — Creates a new sales team member (User + SalesTeamMember)
// PATCH  — Update sales team member (pass ?id=memberId in query)
// DELETE — Soft delete (deactivate) sales team member (pass ?id=memberId in query)
// ============================================================================

import { db } from '@/lib/db';
import { hashPassword } from '@/lib/password-utils';
import { withPlatformAccess, createSuccessResponse, createErrorResponse } from '@/lib/middleware';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const activeFilter = searchParams.get('active');
    const where: Record<string, unknown> = {};

    if (activeFilter === 'true') {
      where.isActive = true;
    } else if (activeFilter === 'false') {
      where.isActive = false;
    }

    const salesTeam = await db.salesTeamMember.findMany({
      where,
      select: {
        id: true,
        userId: true,
        name: true,
        email: true,
        phone: true,
        region: true,
        designation: true,
        reportingManager: true,
        commissionPercent: true,
        target: true,
        achieved: true,
        isActive: true,
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({
      success: true,
      data: salesTeam,
    });
  } catch (error) {
    console.error('[admin/sales-team] Error:', error);
    return NextResponse.json(
      { success: false, error: `Failed to fetch sales team: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, phone, region, designation, reportingManager, commissionPercent, target, isActive } = body;

    // Validate required fields
    if (!name || !email || !phone || !region || target === undefined || target === null) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: name, email, phone, region, target' },
        { status: 400 }
      );
    }

    // Check if email is already in use
    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'A user with this email already exists' },
        { status: 409 }
      );
    }

    // Hash default password
    const passwordHash = await hashPassword('Quantix@123');

    // Create User + SalesTeamMember in a transaction
    const result = await db.$transaction(async (tx) => {
      // Create the User record
      const user = await tx.user.create({
        data: {
          email,
          name,
          phone,
          passwordHash,
          authProvider: 'EMAIL_OTP',
          emailVerified: true,
          isActive: isActive !== undefined ? Boolean(isActive) : true,
        },
      });

      // Create the SalesTeamMember record linked to the user
      const salesMember = await tx.salesTeamMember.create({
        data: {
          userId: user.id,
          name,
          email,
          phone,
          region,
          designation: designation || null,
          reportingManager: reportingManager || null,
          commissionPercent: commissionPercent !== undefined ? Number(commissionPercent) : 5,
          target: Number(target),
          achieved: 0,
          isActive: isActive !== undefined ? Boolean(isActive) : true,
        },
      });

      return salesMember;
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[admin/sales-team] POST Error:', error);
    return NextResponse.json(
      { success: false, error: `Failed to create sales team member: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH /api/admin/sales-team?id=memberId — Update sales team member
// ============================================================================

export async function PATCH(request: NextRequest) {
  return withPlatformAccess(async (req) => {
    try {
      const { searchParams } = new URL(req.url);
      const memberId = searchParams.get('id');

      if (!memberId) {
        return createErrorResponse('Missing ?id= query parameter', 400);
      }

      const body = await req.json();
      const action = new URL(req.url).searchParams.get('action');

      const existing = await db.salesTeamMember.findUnique({
        where: { id: memberId },
      });

      if (!existing) {
        return createErrorResponse('Sales team member not found', 404);
      }

      if (action === 'reset-password' && existing.userId) {
        const passwordHash = await hashPassword('Quantix@123');
        await db.user.update({
          where: { id: existing.userId },
          data: { passwordHash },
        });
        return createSuccessResponse({ message: 'Password reset to default successfully' });
      }

      if (body.email && body.email !== existing.email) {
        const duplicate = await db.salesTeamMember.findFirst({
          where: { email: body.email, id: { not: memberId } },
        });
        if (duplicate) {
          return createErrorResponse('Email already in use', 409);
        }
      }

      const result = await db.$transaction(async (tx) => {
        const updated = await tx.salesTeamMember.update({
          where: { id: memberId },
          data: {
            ...(body.name && { name: body.name }),
            ...(body.email && { email: body.email }),
            ...(body.phone && { phone: body.phone }),
            ...(body.region && { region: body.region }),
            ...(body.designation !== undefined && { designation: body.designation || null }),
            ...(body.reportingManager !== undefined && { reportingManager: body.reportingManager || null }),
            ...(body.commissionPercent !== undefined && { commissionPercent: Number(body.commissionPercent) }),
            ...(body.target !== undefined && { target: Number(body.target) }),
            ...(body.achieved !== undefined && { achieved: Number(body.achieved) }),
            ...(body.isActive !== undefined && { isActive: Boolean(body.isActive) }),
          },
        });

        if (existing.userId) {
          await tx.user.update({
            where: { id: existing.userId },
            data: {
              ...(body.name && { name: body.name }),
              ...(body.email && { email: body.email }),
              ...(body.phone && { phone: body.phone }),
              ...(body.isActive !== undefined && { isActive: Boolean(body.isActive) }),
            },
          });
        }

        return updated;
      });

      return createSuccessResponse(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update sales team member';
      return createErrorResponse(message, 500);
    }
  })(request);
}

// ============================================================================
// DELETE /api/admin/sales-team?id=memberId — Soft delete (deactivate)
// ============================================================================

export async function DELETE(request: NextRequest) {
  return withPlatformAccess(async (req) => {
    try {
      const { searchParams } = new URL(req.url);
      const memberId = searchParams.get('id');

      if (!memberId) {
        return createErrorResponse('Missing ?id= query parameter', 400);
      }

      const existing = await db.salesTeamMember.findUnique({
        where: { id: memberId },
      });

      if (!existing) {
        return createErrorResponse('Sales team member not found', 404);
      }

      await db.$transaction(async (tx) => {
        await tx.salesTeamMember.update({
          where: { id: memberId },
          data: { isActive: false },
        });

        if (existing.userId) {
          await tx.user.update({
            where: { id: existing.userId },
            data: { isActive: false },
          });
        }
      });

      return createSuccessResponse({ message: 'Sales team member deactivated' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete sales team member';
      return createErrorResponse(message, 500);
    }
  })(request);
}
