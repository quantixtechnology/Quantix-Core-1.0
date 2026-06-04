// ============================================================================
// POST /api/core/storefront/auth/forgot-password
// Send a password-reset link. Token is stored on Customer record (not User).
// Anti-enumeration: always returns same success response.
// Body: { email, businessId } OR { email, businessSlug }
// Rate limit: 5 requests per hour per email+business.
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

    // Hostname is the authoritative tenant source — prevents a request on
    // ohhhmomos.quantixtechnology.in from triggering a reset for arbazfreshmeat.
    // Falls back to body businessId/businessSlug when hostname can't resolve
    // (local dev, admin panel, or direct API calls without a subdomain).
    const hostnameBusinessId = await resolveBusinessIdFromRequest(request);
    if (!hostnameBusinessId && !body.businessId && !body.businessSlug) {
      return NextResponse.json({ success: false, error: 'businessId or businessSlug is required' }, { status: 400 });
    }

    const business = await db.business.findFirst({
      where: hostnameBusinessId
        ? { id: hostnameBusinessId }
        : body.businessId ? { id: body.businessId } : { slug: body.businessSlug },
      select: { id: true, name: true, slug: true },
    });
    if (!business) return NextResponse.json(GENERIC_RESPONSE);

    const customer = await db.customer.findFirst({
      where: { businessId: business.id, email },
      select: {
        id: true, name: true, email: true,
        passwordResetTokenExpiry: true, isLoginDisabled: true,
      },
    });
    if (!customer || customer.isLoginDisabled) return NextResponse.json(GENERIC_RESPONSE);

    // Rate limit: count recent tokens issued in the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentlyIssued = customer.passwordResetTokenExpiry &&
      customer.passwordResetTokenExpiry > oneHourAgo &&
      customer.passwordResetTokenExpiry > new Date(Date.now() + (RESET_TOKEN_EXPIRY_MINUTES - 60) * 60 * 1000);

    // Simple rate limit: check if there's already an active unexpired token
    // For more aggressive rate limiting, we track in-memory per email+business
    const rlKey = `fpw:${email}:${business.id}`;
    if (!forgotRateLimit(rlKey, MAX_PER_HOUR)) return NextResponse.json(GENERIC_RESPONSE);

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000);

    await db.customer.update({
      where: { id: customer.id },
      data: {
        passwordResetToken: token,
        passwordResetTokenExpiry: expiresAt,
      },
    });

    const storefrontDomain = process.env.NEXT_PUBLIC_STOREFRONT_DOMAIN ?? 'quantixtechnology.in';
    const resetLink = `https://${business.slug}.${storefrontDomain}/reset-password?token=${token}`;

    const { sent } = await sendPasswordResetEmail({
      to: email,
      resetLink,
      businessName: business.name,
    });

    console.log(`[storefront/auth/forgot-password] email=${email} businessId=${business.id} sent=${sent}`);

    return NextResponse.json({
      ...GENERIC_RESPONSE,
      ...(process.env.NODE_ENV === 'development' ? { devToken: token, resetLink } : {}),
    });
  } catch (error) {
    console.error('[storefront/auth/forgot-password]', error);
    return NextResponse.json({ success: false, error: 'Failed to process request' }, { status: 500 });
  }
}

// In-memory rate limiter (per email+business, 5 req/hr)
const _forgotRlStore = new Map<string, { count: number; resetAt: number }>();
function forgotRateLimit(key: string, max: number): boolean {
  const now = Date.now();
  const window = 60 * 60 * 1000;
  const entry = _forgotRlStore.get(key);
  if (!entry || now > entry.resetAt) {
    _forgotRlStore.set(key, { count: 1, resetAt: now + window });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count++;
  return true;
}
