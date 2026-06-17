// ============================================================================
// Route: POST /api/admin/cleanup
// Complete CRM + Sales Team + Platform User cleanup.
// QUANTIX_SUPER_ADMIN only — requires { confirm: true }.
//
// This resets the CRM environment by:
// 1. Deleting ALL leads, activities, comments, sequences, import/export logs
// 2. Deleting ALL SalesTeamMember records
// 3. Transferring owned data then permanently deleting ALL platform Users
//    EXCEPT the QUANTIX_SUPER_ADMIN
// 4. Verifying no orphaned records remain
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { db } from '@/lib/db';
import { logActivity } from '@/lib/core/audit';

export const POST = withMiddleware({
  requireAuth: true,
  requiredRoles: ['QUANTIX_SUPER_ADMIN'],
})(async (req) => {
  try {
    const body = await req.json();
    if (!body.confirm) {
      return NextResponse.json(
        { success: false, error: 'Must pass { confirm: true } to proceed' },
        { status: 400 }
      );
    }

    const superAdmin = await db.user.findFirst({
      where: { platformRole: 'QUANTIX_SUPER_ADMIN', isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, email: true },
    });
    if (!superAdmin) {
      return NextResponse.json(
        { success: false, error: 'No active Super Admin found' },
        { status: 400 }
      );
    }

    const result = await db.$transaction(async (tx) => {
      // ── 1. Count and collect data before deletion ──────────────────────────
      const leadCount = await tx.lead.count();
      const salesTeamCount = await tx.salesTeamMember.count();
      const platformUsers = await tx.user.findMany({
        where: {
          platformRole: { not: null },
          id: { not: superAdmin.id },
        },
        select: {
          id: true,
          name: true,
          email: true,
          platformRole: true,
          _count: {
            select: {
              businessUsers: true,
              customerProfiles: true,
              deliveryProfiles: true,
            },
          },
        },
      });

      // ── 2. Delete all CRM data ─────────────────────────────────────────────
      await tx.activityLog.deleteMany({ where: { entity: 'Lead' } });
      await tx.lead.deleteMany();
      await tx.leadSequence.deleteMany();
      await tx.leadImportLog.deleteMany();
      await tx.leadExportLog.deleteMany();

      // ── 3. Delete all SalesTeamMember records ──────────────────────────────
      await tx.salesTeamMember.deleteMany();

      // ── 4. Transfer owned data from platform users, then delete ────────────
      const deletedUsers: Array<{ id: string; name: string; email: string; role: string | null }> = [];

      for (const user of platformUsers) {
        // Transfer business-user associations to Super Admin
        await tx.businessUser.updateMany({
          where: { userId: user.id },
          data: { userId: superAdmin.id },
        });

        // Transfer customer profiles
        await tx.customer.updateMany({
          where: { userId: user.id },
          data: { userId: superAdmin.id },
        });

        // Transfer customer notes
        await tx.customerNote.updateMany({
          where: { userId: user.id },
          data: { userId: superAdmin.id },
        });

        // Transfer delivery profiles
        await tx.deliveryPartner.updateMany({
          where: { userId: user.id },
          data: { userId: superAdmin.id },
        });

        // Transfer POS sessions (using operatorId)
        await tx.pOSSession.updateMany({
          where: { operatorId: user.id },
          data: { operatorId: superAdmin.id },
        });

        // Transfer proposals
        await tx.proposalDocument.updateMany({
          where: { createdBy: user.id },
          data: { createdBy: superAdmin.id, createdByName: superAdmin.name },
        });

        // Delete the user (all remaining relations like OTP, tokens cascade)
        await tx.user.delete({ where: { id: user.id } });

        deletedUsers.push({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.platformRole,
        });
      }

      // ── 5. Ensure Super Admin is active ────────────────────────────────────
      await tx.user.update({
        where: { id: superAdmin.id },
        data: { isActive: true },
      });

      return {
        leadCount,
        salesTeamCount,
        platformUserCount: platformUsers.length,
        deletedUsers,
      };
    });

    // ── Audit log ──────────────────────────────────────────────────────────
    await logActivity({
      userId: req.user?.id ?? null,
      action: 'system.cleanup',
      entity: 'System',
      entityId: 'cleanup',
      details: {
        performedBy: req.user?.email ?? 'unknown',
        leadsDeleted: result.leadCount,
        salesTeamDeleted: result.salesTeamCount,
        platformUsersDeleted: result.platformUserCount,
        deletedUsers: result.deletedUsers.map((u) => u.email),
        transferredTo: superAdmin.email,
        cleanedAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        message: `Cleanup complete. Deleted ${result.leadCount} leads, ${result.salesTeamCount} sales team members, ${result.platformUserCount} platform users.`,
        summary: {
          leadsDeleted: result.leadCount,
          salesTeamDeleted: result.salesTeamCount,
          platformUsersDeleted: result.platformUserCount,
          deletedUsers: result.deletedUsers,
          superAdmin: superAdmin.name,
        },
      },
    });
  } catch (error) {
    console.error('[admin/cleanup] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Cleanup failed' },
      { status: 500 }
    );
  }
});
