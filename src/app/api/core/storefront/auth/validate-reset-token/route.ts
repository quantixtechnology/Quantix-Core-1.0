// ============================================================================
// POST /api/core/storefront/auth/validate-reset-token
// Validate a password reset token stored on the PasswordResetToken model.
// Body: { token }
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { token: string };
    const { token } = body;

    if (!token) {
      return NextResponse.json({ success: false, error: 'token is required' }, { status: 400 });
    }

    const hashedToken = hashToken(token);
    const resetToken = await db.passwordResetToken.findUnique({
      where: { token: hashedToken },
      select: { expiresAt: true, usedAt: true },
    });

    const isValid = !!resetToken &&
      !resetToken.usedAt &&
      resetToken.expiresAt > new Date();

    return NextResponse.json({ success: true, valid: isValid });
  } catch (error) {
    console.error('[storefront/auth/validate-reset-token]', error);
    return NextResponse.json({ success: false, error: 'Validation failed' }, { status: 500 });
  }
}
