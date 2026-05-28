// ============================================================================
// POST /api/core/storefront/auth/set-password
// First-time password creation for storefront customers after OTP login.
// Requires: Authorization: Bearer <refreshToken>
// Body: { password, confirmPassword }
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/password-utils';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&\-_#^]).{8,}$/;

function validatePassword(pw: string): string | null {
  if (pw.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(pw)) return 'Password must contain at least one uppercase letter';
  if (!/[a-z]/.test(pw)) return 'Password must contain at least one lowercase letter';
  if (!/[0-9]/.test(pw)) return 'Password must contain at least one number';
  if (!/[@$!%*?&\-_#^]/.test(pw)) return 'Password must contain at least one special character';
  return null;
}

async function resolveCustomerFromToken(authHeader: string | null): Promise<{
  userId: string; customerId: string; email: string; businessId: string;
} | null> {
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return null;

  const rt = await db.refreshToken.findUnique({
    where: { token },
    include: { user: { select: { id: true, email: true, isActive: true } } },
  });
  if (!rt || rt.expiresAt < new Date() || !rt.user.isActive) return null;

  const customer = await db.customer.findFirst({
    where: { userId: rt.user.id },
    select: { id: true, businessId: true },
  });
  if (!customer) return null;

  return { userId: rt.user.id, customerId: customer.id, email: rt.user.email, businessId: customer.businessId };
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const session = await resolveCustomerFromToken(authHeader);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json() as { password: string; confirmPassword: string };
    const { password, confirmPassword } = body;

    if (!password || !confirmPassword) {
      return NextResponse.json({ success: false, error: 'password and confirmPassword are required' }, { status: 400 });
    }
    if (password !== confirmPassword) {
      return NextResponse.json({ success: false, error: 'Passwords do not match' }, { status: 400 });
    }
    const pwError = validatePassword(password);
    if (pwError) {
      return NextResponse.json({ success: false, error: pwError }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { id: true, hasPassword: true },
    });
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }
    if (user.hasPassword) {
      return NextResponse.json(
        { success: false, error: 'Password already set. Use change-password to update it.' },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(password);
    const now = new Date();

    await db.$transaction([
      db.user.update({
        where: { id: session.userId },
        data: { passwordHash, hasPassword: true, authProvider: 'PASSWORD' },
      }),
      db.customer.update({
        where: { id: session.customerId },
        data: { isPasswordSet: true, mustChangePassword: false },
      }),
    ]);

    console.log(`[storefront/auth/set-password] password created userId=${session.userId} email=${session.email}`);

    await db.activityLog.create({
      data: {
        userId: session.userId,
        action: 'customer.password_created',
        entity: 'Customer',
        entityId: session.customerId,
        details: JSON.stringify({ email: session.email, businessId: session.businessId }),
      },
    }).catch(() => null);

    return NextResponse.json({ success: true, message: 'Password created successfully' });
  } catch (error) {
    console.error('[storefront/auth/set-password]', error);
    return NextResponse.json({ success: false, error: 'Failed to set password' }, { status: 500 });
  }
}
