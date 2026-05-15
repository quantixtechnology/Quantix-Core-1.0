// ============================================================================
// QUANTIX CORE — Admin Password Reset
// POST /api/core/users/[userId]/reset-password (platform admin only)
//
// Admin-assigned passwords only. Users cannot reset their own passwords here.
// ============================================================================

import { NextResponse } from 'next/server';
import { withPlatformAccess, createErrorResponse } from '@/lib/middleware';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/password-utils';
import type { NextRequest } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  return withPlatformAccess(async (req) => {
    try {
      const { userId } = await params;
      const body = await req.json().catch(() => ({})) as { newPassword?: string };

      const user = await db.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true },
      });

      if (!user) return createErrorResponse('User not found', 404);

      const rawPassword = body.newPassword || `${user.name.replace(/[^a-zA-Z0-9]/g, '')}@Reset1`;
      if (rawPassword.length < 6) return createErrorResponse('Password must be at least 6 characters', 400);

      const passwordHash = await hashPassword(rawPassword);
      await db.user.update({ where: { id: userId }, data: { passwordHash, authProvider: 'PASSWORD' } });

      await db.activityLog.create({
        data: {
          businessId: 'platform', action: 'user.password_reset', entity: 'User', entityId: userId,
          details: JSON.stringify({ email: user.email, resetBy: 'admin' }),
        },
      }).catch(() => null);

      return NextResponse.json({
        success: true,
        message: 'Password reset successfully',
        credentials: { email: user.email, password: rawPassword },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to reset password';
      return createErrorResponse(message, 500);
    }
  })(request);
}
