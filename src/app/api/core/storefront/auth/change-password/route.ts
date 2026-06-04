// ============================================================================
// POST /api/core/storefront/auth/change-password
// Change password for an authenticated storefront customer.
// Credentials are stored on Customer record — isolated from staff system.
// Requires: Authorization: Bearer <refreshToken>
// Body: { currentPassword, newPassword, confirmPassword }
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, verifyPassword } from '@/lib/password-utils';
import { resolveBusinessIdFromRequest } from '@/lib/tenant-resolver';

function validatePassword(pw: string): string | null {
  if (pw.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(pw)) return 'Password must contain at least one uppercase letter';
  if (!/[a-z]/.test(pw)) return 'Password must contain at least one lowercase letter';
  if (!/[0-9]/.test(pw)) return 'Password must contain at least one number';
  if (!/[@$!%*?&\-_#^]/.test(pw)) return 'Password must contain at least one special character';
  return null;
}

async function resolveCustomerFromToken(
  authHeader: string | null,
  businessId: string | null,
): Promise<{
  customerId: string; businessId: string; email: string; userId: string;
} | null> {
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return null;

  const rt = await db.refreshToken.findUnique({
    where: { token },
    include: { user: { select: { id: true, email: true, isActive: true } } },
  });
  if (!rt || rt.expiresAt < new Date() || !rt.user.isActive) return null;

  // Scope the customer lookup to the specific business when a businessId is known.
  // This prevents a multi-tenant user's change-password from affecting the wrong
  // business's customer record.
  const customer = await db.customer.findFirst({
    where: {
      userId: rt.user.id,
      ...(businessId ? { businessId } : {}),
    },
    select: { id: true, businessId: true },
  });
  if (!customer) return null;

  return { customerId: customer.id, businessId: customer.businessId, email: rt.user.email, userId: rt.user.id };
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    // Hostname is the authoritative tenant source; x-business-id is the fallback
    const hostnameBusinessId = await resolveBusinessIdFromRequest(request);
    const businessId = hostnameBusinessId || request.headers.get('x-business-id') || null;
    const ctx = await resolveCustomerFromToken(authHeader, businessId);
    if (!ctx) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json() as {
      currentPassword: string;
      newPassword: string;
      confirmPassword: string;
    };

    const { currentPassword, newPassword, confirmPassword } = body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json(
        { success: false, error: 'currentPassword, newPassword and confirmPassword are required' },
        { status: 400 }
      );
    }
    if (newPassword !== confirmPassword) {
      return NextResponse.json({ success: false, error: 'New passwords do not match' }, { status: 400 });
    }
    if (currentPassword === newPassword) {
      return NextResponse.json(
        { success: false, error: 'New password must be different from current password' },
        { status: 400 }
      );
    }
    const pwError = validatePassword(newPassword);
    if (pwError) {
      return NextResponse.json({ success: false, error: pwError }, { status: 400 });
    }

    const customer = await db.customer.findUnique({
      where: { id: ctx.customerId },
      select: { id: true, passwordHash: true, isPasswordSet: true, isLoginDisabled: true },
    });
    if (!customer) {
      return NextResponse.json({ success: false, error: 'Customer not found' }, { status: 404 });
    }
    if (customer.isLoginDisabled) {
      return NextResponse.json({ success: false, error: 'Account is disabled. Contact the store.' }, { status: 403 });
    }
    if (!customer.isPasswordSet || !customer.passwordHash) {
      return NextResponse.json(
        { success: false, error: 'No password set. Use set-password first.' },
        { status: 400 }
      );
    }

    const isCurrentValid = await verifyPassword(currentPassword, customer.passwordHash);
    if (!isCurrentValid) {
      return NextResponse.json({ success: false, error: 'Current password is incorrect' }, { status: 401 });
    }

    const newHash = await hashPassword(newPassword);
    const now = new Date();

    await db.customer.update({
      where: { id: ctx.customerId },
      data: {
        passwordHash: newHash,
        passwordUpdatedAt: now,
        mustChangePassword: false,
        failedLoginAttempts: 0,
        accountLockedUntil: null,
      },
    });

    console.log(`[storefront/auth/change-password] ok customerId=${ctx.customerId} email=${ctx.email}`);

    await db.activityLog.create({
      data: {
        userId: ctx.userId,
        action: 'customer.password_changed',
        entity: 'Customer',
        entityId: ctx.customerId,
        details: JSON.stringify({ email: ctx.email, businessId: ctx.businessId }),
      },
    }).catch(() => null);

    return NextResponse.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('[storefront/auth/change-password]', error);
    return NextResponse.json({ success: false, error: 'Failed to change password' }, { status: 500 });
  }
}
