// ============================================================================
// POST /api/core/storefront/auth/forgot-password
// Send a password-reset link to the customer's email.
// Anti-enumeration: always returns success regardless of whether account exists.
// Body: { email, businessId } OR { email, businessSlug }
// Rate limit: 5 requests per hour per email+business.
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendPasswordResetEmail } from '@/lib/email-service';
import { normalizeEmail } from '@/lib/storefront-auth';
import crypto from 'crypto';

const RESET_TOKEN_EXPIRY_MINUTES = 15;
const MAX_PER_HOUR = 5;

const GENERIC_RESPONSE = {
  success: true,
  message: 'If an account with that email exists, a password reset link has been sent.',
};

function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      email: string;
      businessId?: string;
      businessSlug?: string;
    };

    const email = normalizeEmail(body.email || '');

    if (!email) {
      return NextResponse.json({ success: false, error: 'email is required' }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ success: false, error: 'Invalid email format' }, { status: 400 });
    }
    if (!body.businessId && !body.businessSlug) {
      return NextResponse.json({ success: false, error: 'businessId or businessSlug is required' }, { status: 400 });
    }

    // Resolve business
    const business = await db.business.findFirst({
      where: body.businessId
        ? { id: body.businessId }
        : { slug: body.businessSlug },
      select: { id: true, name: true, slug: true },
    });

    if (!business) return NextResponse.json(GENERIC_RESPONSE);

    // Rate limit
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await db.passwordResetToken.count({
      where: {
        user: { customerProfiles: { some: { businessId: business.id, email } } },
        createdAt: { gte: oneHourAgo },
      },
    });
    if (recentCount >= MAX_PER_HOUR) {
      // Return generic success to prevent enumeration even on rate limit
      return NextResponse.json(GENERIC_RESPONSE);
    }

    // Find customer in this business
    const customer = await db.customer.findFirst({
      where: { businessId: business.id, email },
      select: { userId: true, name: true },
    });

    if (!customer?.userId) return NextResponse.json(GENERIC_RESPONSE);

    const user = await db.user.findUnique({
      where: { id: customer.userId },
      select: { id: true, isActive: true },
    });

    if (!user?.isActive) return NextResponse.json(GENERIC_RESPONSE);

    // Invalidate all existing unused tokens for this user
    await db.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });

    const token = generateSecureToken();
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000);

    await db.passwordResetToken.create({
      data: { userId: user.id, token, expiresAt },
    });

    const storefrontDomain = process.env.NEXT_PUBLIC_STOREFRONT_DOMAIN ?? 'quantixtechnology.in';
    const resetLink = `https://${business.slug}.${storefrontDomain}/reset-password?token=${token}`;

    const { sent } = await sendPasswordResetEmail({
      to: email,
      resetLink,
      businessName: business.name,
    });

    console.log(
      `[storefront/auth/forgot-password] email=${email} businessId=${business.id} tokenIssued=true sent=${sent}`
    );

    return NextResponse.json({
      ...GENERIC_RESPONSE,
      ...(process.env.NODE_ENV === 'development' ? { devToken: token, resetLink } : {}),
    });
  } catch (error) {
    console.error('[storefront/auth/forgot-password]', error);
    return NextResponse.json({ success: false, error: 'Failed to process request' }, { status: 500 });
  }
}
