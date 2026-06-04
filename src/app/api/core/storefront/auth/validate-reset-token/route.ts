// ============================================================================
// POST /api/core/storefront/auth/validate-reset-token
// Validate a password reset token stored on the Customer record.
// Body: { token, businessId? }
// businessId is optional but should be passed — it scopes the token lookup
// to the correct tenant so a token from Business A cannot be validated in
// Business B's context.
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveBusinessIdFromRequest } from '@/lib/tenant-resolver';

export async function POST(request: Request) {
  try {
    const body = await request.json() as { token: string; businessId?: string };
    const { token, businessId: bodyBusinessId } = body;

    if (!token) {
      return NextResponse.json({ success: false, error: 'token is required' }, { status: 400 });
    }

    // Hostname is primary; body businessId is fallback
    const hostnameBusinessId = await resolveBusinessIdFromRequest(request);
    const businessId = hostnameBusinessId || bodyBusinessId || null;

    const customer = await db.customer.findFirst({
      where: {
        passwordResetToken: token,
        ...(businessId ? { businessId } : {}),
      },
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
