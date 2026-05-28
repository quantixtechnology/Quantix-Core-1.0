// ============================================================================
// POST /api/core/storefront/auth/validate-reset-token
// Validate a password reset token (checks expiry and single-use).
// Body: { token }
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json() as { token: string };
    const { token } = body;

    if (!token) {
      return NextResponse.json({ success: false, error: 'token is required' }, { status: 400 });
    }

    const record = await db.passwordResetToken.findUnique({
      where: { token },
      select: { expiresAt: true, usedAt: true },
    });

    const isValid = !!record && record.expiresAt > new Date() && record.usedAt === null;

    return NextResponse.json({ success: true, valid: isValid });
  } catch (error) {
    console.error('[storefront/auth/validate-reset-token]', error);
    return NextResponse.json({ success: false, error: 'Validation failed' }, { status: 500 });
  }
}
