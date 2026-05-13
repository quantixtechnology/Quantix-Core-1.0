// ============================================================================
// QUANTIX CORE — Admin Password Reset
// POST /api/core/users/[userId]/reset-password
//
// ADMIN-ONLY. Users cannot reset their own passwords.
// New password is always assigned by a Super Admin or Business Owner.
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/password-utils';

type Params = { params: Promise<{ userId: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { userId } = await params;
    const body = await request.json().catch(() => ({})) as { newPassword?: string };

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // Admin assigns password — generate one if not provided
    const rawPassword = body.newPassword || `${user.name.replace(/[^a-zA-Z0-9]/g, '')}@Reset1`;
    if (rawPassword.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(rawPassword);
    await db.user.update({
      where: { id: userId },
      data: { passwordHash, authProvider: 'PASSWORD' },
    });

    // Log the action
    await db.activityLog.create({
      data: {
        businessId: 'platform',
        action: 'user.password_reset',
        entity: 'User',
        entityId: userId,
        details: JSON.stringify({ email: user.email, resetBy: 'admin' }),
      },
    }).catch(() => null);

    return NextResponse.json({
      success: true,
      message: 'Password reset successfully',
      credentials: {
        email: user.email,
        password: rawPassword,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to reset password';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
