// ============================================================================
// QUANTIX CORE — Lead Reset API
// POST /api/admin/leads/reset — Backup and delete all leads (Super Admin only)
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { db } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export const POST = withMiddleware({
  requireAuth: true,
  requiredRoles: ['QUANTIX_SUPER_ADMIN'],
})(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const confirmed = body.confirm === true;
    if (!confirmed) {
      return NextResponse.json({
        success: false,
        error: 'Confirmation required. Set confirm: true in the request body.',
        hint: 'This will delete ALL lead records. A backup will be created first.',
      }, { status: 400 });
    }

    // 1. Export all leads to a backup file
    const leads = await db.lead.findMany({ orderBy: { createdAt: 'desc' } });
    const backupDir = join(process.cwd(), 'backups');
    await mkdir(backupDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = join(backupDir, `leads-backup-${timestamp}.json`);
    await writeFile(backupFile, JSON.stringify(leads, null, 2), 'utf-8');

    const leadCount = leads.length;
    const proposalCount = await db.proposalDocument.count({ where: { leadId: { not: null } } });
    const activityCount = await db.activityLog.count({ where: { entity: 'Lead' } });
    const demoCount = await db.demoTenant.count({ where: { currentLeadId: { not: null } } });

    // 2. Delete in transaction (order matters for FK constraints)
    await db.$transaction(async (tx) => {
      await tx.proposalDocument.updateMany({ where: { leadId: { not: null } }, data: { leadId: null } });
      await tx.demoTenant.updateMany({ where: { currentLeadId: { not: null } }, data: { currentLeadId: null, currentLeadName: null } });
      await tx.activityLog.deleteMany({ where: { entity: 'Lead' } });
      await tx.lead.deleteMany({});
    });

    // 3. Reset lead sequence
    await db.leadSequence.deleteMany({});

    return NextResponse.json({
      success: true,
      data: {
        message: 'All leads have been deleted',
        backupFile,
        recordsDeleted: {
          leads: leadCount,
          proposalsUnlinked: proposalCount,
          activityLogsDeleted: activityCount,
          demosUnlinked: demoCount,
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to reset leads';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
