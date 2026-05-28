// ============================================================================
// Route: POST /api/core/auth/set-password
// First-time password creation — for OTP-authenticated users who have no password yet.
// Does NOT require a current password. Use change-password for updates.
// Body: { userId, password }
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/password-utils';

function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter';
  if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number';
  return null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      userId: string;
      password: string;
    };

    const { userId, password } = body;

    if (!userId || !password) {
      return NextResponse.json(
        { success: false, error: 'userId and password are required' },
        { status: 400 }
      );
    }

    const strengthError = validatePasswordStrength(password);
    if (strengthError) {
      return NextResponse.json(
        { success: false, error: strengthError },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, passwordHash: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    if (user.passwordHash) {
      return NextResponse.json(
        { success: false, error: 'Password already set. Use change-password to update it.' },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(password);

    await db.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        hasPassword: true,
        authProvider: 'PASSWORD',
      },
    });

    console.log(`[AUTH SET-PASSWORD] password created userId=${userId} email=${user.email}`);

    await db.activityLog.create({
      data: {
        userId,
        action: 'user.password_created',
        entity: 'User',
        entityId: userId,
        details: JSON.stringify({ email: user.email }),
      },
    }).catch(() => null);

    return NextResponse.json({ success: true, message: 'Password created successfully' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to set password';
    console.error('[set-password] Error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
