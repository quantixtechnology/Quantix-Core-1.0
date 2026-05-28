// ============================================================================
// POST /api/core/businesses/[businessId]/customers/[customerId]/send-password-reset
// Admin: send a password reset link to a customer via email (Option A — most secure).
// Requires: CLIENT_OWNER or STORE_MANAGER role for this business.
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { db } from '@/lib/db';
import { sendPasswordResetEmail } from '@/lib/email-service';
import crypto from 'crypto';

const RESET_TOKEN_EXPIRY_MINUTES = 15;

export const POST = withMiddleware({ requireAuth: true })(async (req, context) => {
  try {
    const params = await context?.params;
    const businessId = params?.businessId as string;
    const customerId = params?.customerId as string;

    if (!businessId || !customerId) {
      return NextResponse.json({ success: false, error: 'businessId and customerId are required' }, { status: 400 });
    }

    const user = req.user!;
    const allowedRoles = ['CLIENT_OWNER', 'STORE_MANAGER', 'QUANTIX_SUPER_ADMIN', 'PLATFORM_ADMIN'];
    if (!user.isPlatformAdmin && user.businessId !== businessId) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }
    if (!user.isPlatformAdmin && !allowedRoles.includes(user.role)) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const business = await db.business.findUnique({
      where: { id: businessId },
      select: { id: true, name: true, slug: true },
    });
    if (!business) {
      return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 });
    }

    const customer = await db.customer.findFirst({
      where: { id: customerId, businessId },
      select: { id: true, email: true, name: true, userId: true },
    });
    if (!customer) {
      return NextResponse.json({ success: false, error: 'Customer not found' }, { status: 404 });
    }
    if (!customer.email) {
      return NextResponse.json({ success: false, error: 'Customer has no email address' }, { status: 400 });
    }
    if (!customer.userId) {
      return NextResponse.json(
        { success: false, error: 'Customer has no linked account. Ask them to login via OTP first.' },
        { status: 400 }
      );
    }

    const linkedUser = await db.user.findUnique({
      where: { id: customer.userId },
      select: { id: true, isActive: true },
    });
    if (!linkedUser?.isActive) {
      return NextResponse.json({ success: false, error: 'Customer account is inactive' }, { status: 400 });
    }

    // Invalidate existing unused tokens
    await db.passwordResetToken.updateMany({
      where: { userId: customer.userId, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000);

    await db.passwordResetToken.create({
      data: { userId: customer.userId, token, expiresAt },
    });

    const storefrontDomain = process.env.NEXT_PUBLIC_STOREFRONT_DOMAIN ?? 'quantixtechnology.in';
    const resetLink = `https://${business.slug}.${storefrontDomain}/reset-password?token=${token}`;

    const { sent, error: sendError } = await sendPasswordResetEmail({
      to: customer.email,
      resetLink,
      businessName: business.name,
    });

    console.log(
      `[admin/customers/send-password-reset] adminId=${user.id} customerId=${customerId} businessId=${businessId} sent=${sent}`
    );

    await db.activityLog.create({
      data: {
        userId: user.id,
        action: 'admin.customer_password_reset_sent',
        entity: 'Customer',
        entityId: customerId,
        details: JSON.stringify({ businessId, customerEmail: customer.email, sent }),
      },
    }).catch(() => null);

    return NextResponse.json({
      success: true,
      message: sent
        ? `Password reset link sent to ${customer.email}`
        : 'Reset link generated but email delivery failed.',
      sent,
      ...(sendError ? { warning: sendError } : {}),
    });
  } catch (error) {
    console.error('[admin/customers/send-password-reset]', error);
    return NextResponse.json({ success: false, error: 'Failed to send reset link' }, { status: 500 });
  }
});
