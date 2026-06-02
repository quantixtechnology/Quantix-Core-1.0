// ============================================================================
// POST /api/core/storefront/auth/set-password
// First-time password creation for storefront customers (Customer-owned credentials).
// Passwords are stored on the Customer record — isolated from Business Staff system.
// Requires: Authorization: Bearer <refreshToken>
// Body: { password, confirmPassword }
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/password-utils';
import { sendWelcomeEmail } from '@/lib/email-service';

function validatePassword(pw: string): string | null {
  if (pw.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(pw)) return 'Password must contain at least one uppercase letter';
  if (!/[a-z]/.test(pw)) return 'Password must contain at least one lowercase letter';
  if (!/[0-9]/.test(pw)) return 'Password must contain at least one number';
  if (!/[@$!%*?&\-_#^]/.test(pw)) return 'Password must contain at least one special character';
  return null;
}

async function resolveCustomerFromToken(authHeader: string | null, requestedBusinessId?: string): Promise<{
  customerId: string; businessId: string; email: string; userId: string; customerName: string;
} | null> {
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return null;

  const rt = await db.refreshToken.findUnique({
    where: { token },
    include: { user: { select: { id: true, email: true, isActive: true } } },
  });
  if (!rt || rt.expiresAt < new Date() || !rt.user.isActive) return null;

  // Scope by businessId when provided to handle users with multiple tenants.
  const customerWhere = requestedBusinessId
    ? { userId: rt.user.id, businessId: requestedBusinessId }
    : { userId: rt.user.id };

  const customer = await db.customer.findFirst({
    where: customerWhere,
    select: { id: true, businessId: true, name: true },
  });
  if (!customer) return null;

  return {
    customerId: customer.id,
    businessId: customer.businessId,
    email: rt.user.email,
    userId: rt.user.id,
    customerName: customer.name,
  };
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const body = await request.json() as { password: string; confirmPassword: string; businessId?: string };
    const ctx = await resolveCustomerFromToken(authHeader, body.businessId);
    if (!ctx) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    const { password, confirmPassword } = body as { password: string; confirmPassword: string; businessId?: string };

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

    const customer = await db.customer.findUnique({
      where: { id: ctx.customerId },
      select: { id: true, isPasswordSet: true, isLoginDisabled: true },
    });
    if (!customer) {
      return NextResponse.json({ success: false, error: 'Customer not found' }, { status: 404 });
    }
    if (customer.isLoginDisabled) {
      return NextResponse.json({ success: false, error: 'Account is disabled. Contact the store.' }, { status: 403 });
    }
    if (customer.isPasswordSet) {
      return NextResponse.json(
        { success: false, error: 'Password already set. Use change-password to update it.' },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(password);
    const now = new Date();

    await db.customer.update({
      where: { id: ctx.customerId },
      data: {
        passwordHash,
        isPasswordSet: true,
        passwordCreatedAt: now,
        passwordUpdatedAt: now,
        mustChangePassword: false,
      },
    });

    // Sync to User so check-customer returns hasPassword:true on all storefronts
    await db.user.update({
      where: { id: ctx.userId },
      data: { passwordHash },
    }).catch(() => null);

    console.log(`[storefront/auth/set-password] ok customerId=${ctx.customerId} email=${ctx.email}`);

    // Send welcome email on first-time password setup
    const business = await db.business.findUnique({
      where: { id: ctx.businessId },
      select: { name: true, slug: true },
    }).catch(() => null);

    if (business) {
      const storefrontDomain = process.env.NEXT_PUBLIC_STOREFRONT_DOMAIN ?? 'quantixtechnology.in';
      sendWelcomeEmail({
        to: ctx.email,
        customerName: ctx.customerName,
        businessName: business.name,
        storefrontUrl: `https://${business.slug}.${storefrontDomain}`,
      }).catch(() => null); // non-blocking, non-fatal
    }

    await db.activityLog.create({
      data: {
        userId: ctx.userId,
        action: 'customer.password_created',
        entity: 'Customer',
        entityId: ctx.customerId,
        details: JSON.stringify({ email: ctx.email, businessId: ctx.businessId }),
      },
    }).catch(() => null);

    return NextResponse.json({ success: true, message: 'Password created successfully' });
  } catch (error) {
    console.error('[storefront/auth/set-password]', error);
    return NextResponse.json({ success: false, error: 'Failed to set password' }, { status: 500 });
  }
}
