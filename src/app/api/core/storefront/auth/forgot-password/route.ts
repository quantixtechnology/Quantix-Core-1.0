// ============================================================================
// POST /api/core/storefront/auth/forgot-password
// Send a password-reset link. Token is stored on PasswordResetToken model
// (User-level, not Customer-level). Reset is global — any User with this
// email can reset their password and it applies to all businesses.
//
// Body: { email, businessId }
// Rate limit: 5 requests per hour per email.
// Anti-enumeration: always returns same generic success response.
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendPasswordResetEmail } from '@/lib/email-service';
import { normalizeEmail } from '@/lib/storefront-auth';
import { resolveBusinessIdFromRequest } from '@/lib/tenant-resolver';
import crypto from 'crypto';

const RESET_TOKEN_EXPIRY_MINUTES = 15;
const MAX_PER_HOUR = 5;

const GENERIC_RESPONSE = {
  success: true,
  message: 'If an account with that email exists, a password reset link has been sent.',
};

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      email: string;
      businessId?: string;
    };

    const email = normalizeEmail(body.email || '');

    if (!email) {
      return NextResponse.json({ success: false, error: 'email is required' }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ success: false, error: 'Invalid email format' }, { status: 400 });
    }

    // Resolve business for storefront context (name, slug) in the reset email.
    // Falls back to body businessId when hostname can't resolve (direct API calls).
    const hostnameBusinessId = await resolveBusinessIdFromRequest(request);
    const resolvedBusinessId = hostnameBusinessId || body.businessId;
    if (!resolvedBusinessId) {
      return NextResponse.json({ success: false, error: 'businessId is required' }, { status: 400 });
    }

    const business = await db.business.findUnique({
      where: { id: resolvedBusinessId },
      select: { id: true, name: true, slug: true },
    });
    if (!business) return NextResponse.json(GENERIC_RESPONSE);

    // Look up the global User record — reset is User-level, not Customer-level.
    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, email: true, isActive: true },
    });
    if (!user || !user.isActive) return NextResponse.json(GENERIC_RESPONSE);

    // Rate limit: count PasswordResetToken records created in the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await db.passwordResetToken.count({
      where: { userId: user.id, createdAt: { gte: oneHourAgo } },
    });
    if (recentCount >= MAX_PER_HOUR) return NextResponse.json(GENERIC_RESPONSE);

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000);

    await db.passwordResetToken.create({
      data: {
        userId: user.id,
        token: hashedToken,
        expiresAt,
      },
    });

    const storefrontDomain = process.env.NEXT_PUBLIC_STOREFRONT_DOMAIN ?? 'quantixtechnology.in';
    const resetLink = `https://${business.slug}.${storefrontDomain}/reset-password?token=${rawToken}&_storefront=${business.slug}`;

    const { sent } = await sendPasswordResetEmail({
      to: email,
      resetLink,
      businessName: business.name,
    });

    console.log(`[storefront/auth/forgot-password] email=${email} businessId=${business.id} sent=${sent}`);

    return NextResponse.json({
      ...GENERIC_RESPONSE,
      ...(process.env.NODE_ENV === 'development' ? { devToken: rawToken, resetLink } : {}),
    });
  } catch (error) {
    console.error('[storefront/auth/forgot-password]', error);
    return NextResponse.json({ success: false, error: 'Failed to process request' }, { status: 500 });
  }
}
