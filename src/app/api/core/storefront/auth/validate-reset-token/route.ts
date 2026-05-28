// ============================================================================
// POST /api/core/storefront/auth/validate-reset-token
// Validate a password reset token stored on the Customer record.
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

    const customer = await db.customer.findFirst({
      where: { passwordResetToken: token },
      select: { passwordResetTokenExpiry: true },
    });

    const isValid = !!customer &&
      !!customer.passwordResetTokenExpiry &&
      customer.passwordResetTokenExpiry > new Date();

    return NextResponse.json({ success: true, valid: isValid });
  } catch (error) {
    console.error('[storefront/auth/validate-reset-token]', error);
    return NextResponse.json({ success: false, error: 'Validation failed' }, { status: 500 });
  }
}
