// ============================================================================
// QUANTIX CORE — User Deletion API
// POST /api/core/users/[userId]/delete — Soft delete with record transfer
// (QUANTIX_SUPER_ADMIN only)
//
// 1. Transfers leads, follow-ups, tasks → Quantix Super Admin
// 2. Soft deletes user (isActive=false, hidden from dropdowns)
// 3. Creates audit log with full transfer details
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { db } from '@/lib/db';
import type { NextRequest } from 'next/server';

export const POST = withMiddleware({
  requireAuth: true,
  requiredRoles: ['QUANTIX_SUPER_ADMIN'],
})(async (req, context) => {
  try {
    const params = await context?.params;
    const userId = params?.userId as string;
    if (!userId) return NextResponse.json({ success: false, error: 'userId is required' }, { status: 400 });

    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true, name: true, email: true, isActive: true, platformRole: true,
        salesProfile: { select: { id: true, name: true } },
      },
    });
    if (!user) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });

    if (user.platformRole === 'QUANTIX_SUPER_ADMIN') {
      return NextResponse.json({ success: false, error: 'Cannot delete the Super Admin account' }, { status: 403 });
    }

    const adminUser = req.user!;

    // Find Quantix Super Admin as transfer target
    const superAdmin = await db.user.findFirst({
      where: { platformRole: 'QUANTIX_SUPER_ADMIN', isActive: true, id: { not: userId } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, email: true },
    });
    if (!superAdmin) {
      return NextResponse.json({ success: false, error: 'No active Super Admin found to transfer records to' }, { status: 400 });
    }

    const salesTeamMemberId = user.salesProfile?.id;

    // Count records to be transferred
    const [leadCount, directLeadCount, proposalCount, businessCount, activityCount, commissionCount] = await Promise.all([
      salesTeamMemberId ? db.lead.count({ where: { salesRepId: salesTeamMemberId } }) : 0,
      db.lead.count({ where: { assignedToUserId: userId } }),
      db.proposalDocument.count({ where: { createdBy: userId } }),
      salesTeamMemberId ? db.business.count({ where: { salesRepId: salesTeamMemberId } }) : 0,
      db.activityLog.count({ where: { userId } }),
      db.commissionCalculation.count({ where: { salesPersonId: salesTeamMemberId || userId } }),
    ]);

    const superAdminSalesTeam = await db.salesTeamMember.findFirst({
      where: { userId: superAdmin.id },
      select: { id: true },
    });

    // Execute transfer and deactivation
    await db.$transaction(async (tx) => {
      // Transfer leads to Super Admin's sales profile
      if (salesTeamMemberId) {
        if (superAdminSalesTeam) {
          await tx.lead.updateMany({
            where: { salesRepId: salesTeamMemberId },
            data: { salesRepId: superAdminSalesTeam.id },
          });
        } else {
          await tx.lead.updateMany({
            where: { salesRepId: salesTeamMemberId },
            data: { salesRepId: null },
          });
        }
      }

      // Transfer direct-assigned leads (assignedToUserId)
      await tx.lead.updateMany({
        where: { assignedToUserId: userId },
        data: { assignedToUserId: superAdmin.id },
      });

      // Transfer business clients
      if (salesTeamMemberId) {
        await tx.business.updateMany({
          where: { salesRepId: salesTeamMemberId },
          data: { salesRepId: superAdminSalesTeam?.id || null },
        });

        // Deactivate SalesTeamMember
        await tx.salesTeamMember.update({
          where: { id: salesTeamMemberId },
          data: { isActive: false },
        });
      }

      // Unlink proposals
      await tx.proposalDocument.updateMany({
        where: { createdBy: userId },
        data: { createdBy: superAdmin.id, createdByName: superAdmin.name },
      });

      // Soft delete user
      await tx.user.update({
        where: { id: userId },
        data: { isActive: false },
      });

      // Create audit log
      await tx.activityLog.create({
        data: {
          businessId: 'platform',
          action: 'user.deleted',
          entity: 'User',
          entityId: userId,
          details: JSON.stringify({
            deletedUser: { name: user.name, email: user.email },
            deletedBy: { name: adminUser.email, id: adminUser.id },
            transferredTo: { name: superAdmin.name, email: superAdmin.email, id: superAdmin.id },
            recordsTransferred: {
              leads: leadCount,
              directLeads: directLeadCount,
              proposals: proposalCount,
              businesses: businessCount,
              activities: activityCount,
              commissions: commissionCount,
            },
            transferredAt: new Date().toISOString(),
          }),
        },
      });
    });

    return NextResponse.json({
      success: true,
      data: {
        message: `User ${user.name} has been deactivated and records transferred to ${superAdmin.name}`,
        user: { id: user.id, name: user.name, email: user.email },
        transferredTo: superAdmin,
        recordsTransferred: {
          leads: leadCount,
          directLeads: directLeadCount,
          proposals: proposalCount,
          businesses: businessCount,
          activities: activityCount,
          commissions: commissionCount,
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete user';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
