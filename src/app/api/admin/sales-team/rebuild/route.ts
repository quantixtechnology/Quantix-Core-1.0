// ============================================================================
// QUANTIX CORE — Sales Team Rebuild API
// POST /api/admin/sales-team/rebuild — Create User records for sales team
// members missing linked platform users (Super Admin only)
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/password-utils';

export const POST = withMiddleware({
  requireAuth: true,
  requiredRoles: ['QUANTIX_SUPER_ADMIN'],
})(async () => {
  try {
    const users = await db.user.findMany({ select: { id: true, email: true } });
    const userEmails = new Set(users.map(u => u.email.toLowerCase()));

    const salesTeam = await db.salesTeamMember.findMany({
      where: { isActive: true },
      select: { id: true, userId: true, name: true, email: true, phone: true },
    });

    const created: { salesTeamId: string; name: string; email: string; password: string }[] = [];
    const alreadyLinked: string[] = [];
    const errors: { name: string; email: string; error: string }[] = [];

    for (const member of salesTeam) {
      try {
        if (member.userId) {
          const userExists = await db.user.findUnique({ where: { id: member.userId } });
          if (userExists) {
            alreadyLinked.push(member.name);
            continue;
          }
        }

        const emailLower = member.email.toLowerCase();
        if (userEmails.has(emailLower)) {
          const existingUser = await db.user.findUnique({ where: { email: member.email } });
          if (existingUser) {
            await db.salesTeamMember.update({
              where: { id: member.id },
              data: { userId: existingUser.id },
            });
            alreadyLinked.push(`${member.name} (re-linked to existing user ${existingUser.email})`);
            continue;
          }
        }

        const rawPassword = `${member.name.replace(/[^a-zA-Z0-9]/g, '')}@${Math.floor(1000 + Math.random() * 9000)}`;
        const passwordHash = await hashPassword(rawPassword);

        await db.$transaction(async (tx) => {
          const user = await tx.user.create({
            data: {
              email: member.email,
              loginId: member.email,
              name: member.name,
              phone: member.phone,
              passwordHash,
              authProvider: 'PASSWORD',
              emailVerified: true,
              isActive: true,
              mustChangePassword: true,
              platformRole: 'QUANTIX_SALES_TEAM',
            },
          });

          await tx.salesTeamMember.update({
            where: { id: member.id },
            data: { userId: user.id },
          });
        });

        userEmails.add(member.email.toLowerCase());
        created.push({ salesTeamId: member.id, name: member.name, email: member.email, password: rawPassword });
      } catch (err) {
        errors.push({ name: member.name, email: member.email, error: err instanceof Error ? err.message : 'Unknown error' });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        totalProcessed: salesTeam.length,
        created: created.length,
        alreadyLinked: alreadyLinked.length,
        errors: errors.length,
        details: { created, alreadyLinked, errors },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Rebuild failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
