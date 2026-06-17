// ============================================================================
// QUANTIX CORE — User/Sales/Lead Audit API
// GET /api/admin/audit — Full audit report (Super Admin only)
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { db } from '@/lib/db';

export const GET = withMiddleware({
  requireAuth: true,
  requiredRoles: ['QUANTIX_SUPER_ADMIN'],
})(async () => {
  try {
    const [users, salesTeam, leads, activityLogs, proposals, commissions, businesses] = await Promise.all([
      db.user.findMany({ select: { id: true, name: true, email: true, phone: true, isActive: true, platformRole: true, createdAt: true } }),
      db.salesTeamMember.findMany({ select: { id: true, userId: true, name: true, email: true, phone: true, isActive: true, createdAt: true } }),
      db.lead.findMany({ select: { id: true, salesRepId: true, businessName: true, stage: true, createdAt: true } }),
      db.activityLog.findMany({ where: { entity: 'Lead' }, select: { id: true, entityId: true, userId: true, action: true, createdAt: true } }),
      db.proposalDocument.findMany({ select: { id: true, leadId: true, createdBy: true, status: true } }),
      db.commissionCalculation.findMany({ select: { id: true, salesPersonId: true, salesPersonName: true } }),
      db.business.findMany({ where: { salesRepId: { not: null } }, select: { id: true, name: true, salesRepId: true } }),
    ]);

    const salesTeamUserIds = new Set(salesTeam.map(s => s.userId).filter(Boolean));
    const salesTeamIds = new Set(salesTeam.map(s => s.id));
    const userIds = new Set(users.map(u => u.id));
    const userPlatformRoles = new Map(users.map(u => [u.id, u.platformRole]));

    const orphanedSalesTeamMembers = salesTeam.filter(s => !userIds.has(s.userId));
    const orphanedLeads = leads.filter(l => l.salesRepId && !salesTeamIds.has(l.salesRepId));
    const salesTeamMembersWithDeletedUsers = salesTeam.filter(s => s.userId && !userIds.has(s.userId));

    const assignedLeads = leads.filter(l => l.salesRepId);
    const unassignedLeads = leads.filter(l => !l.salesRepId);

    const platformUsers = users.filter(u => u.platformRole);
    const platformUsersWithoutSalesProfile = platformUsers.filter(u => {
      const role = u.platformRole as string;
      return role === 'QUANTIX_SALES_TEAM' && !salesTeamUserIds.has(u.id);
    });

    const activeSalesTeam = salesTeam.filter(s => s.isActive);
    const activeUsersWithSalesRole = users.filter(u => u.platformRole === 'QUANTIX_SALES_TEAM' && u.isActive);

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalUsers: users.length,
          activeUsers: users.filter(u => u.isActive).length,
          totalSalesTeam: salesTeam.length,
          activeSalesTeam: activeSalesTeam.length,
          totalLeads: leads.length,
          assignedLeads: assignedLeads.length,
          unassignedLeads: unassignedLeads.length,
          totalActivityLogs: activityLogs.length,
          totalProposals: proposals.length,
          totalCommissionRecords: commissions.length,
          businessesWithSalesRep: businesses.length,
        },
        users: users.map(u => ({
          id: u.id, name: u.name, email: u.email, phone: u.phone,
          isActive: u.isActive, platformRole: u.platformRole, createdAt: u.createdAt,
          hasSalesProfile: salesTeamUserIds.has(u.id),
        })),
        salesTeam: salesTeam.map(s => ({
          id: s.id, userId: s.userId, name: s.name, email: s.email, phone: s.phone,
          isActive: s.isActive, createdAt: s.createdAt,
          userExists: s.userId ? userIds.has(s.userId) : false,
          userRole: s.userId ? (userPlatformRoles.get(s.userId) || null) : null,
        })),
        integrity: {
          orphanedSalesTeamMembers: orphanedSalesTeamMembers.map(s => ({ id: s.id, name: s.name, email: s.email, userId: s.userId })),
          salesTeamMembersWithDeletedUsers: salesTeamMembersWithDeletedUsers.map(s => ({ id: s.id, name: s.name, userId: s.userId })),
          orphanedLeads: orphanedLeads.map(l => ({ id: l.id, businessName: l.businessName, salesRepId: l.salesRepId })),
          platformSalesTeamUsersWithoutProfile: platformUsersWithoutSalesProfile.map(u => ({ id: u.id, name: u.name, email: u.email })),
          mismatchCount: {
            usersWithSalesRole: activeUsersWithSalesRole.length,
            activeSalesTeamCount: activeSalesTeam.length,
            isBalanced: activeUsersWithSalesRole.length === activeSalesTeam.length,
          },
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Audit failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
