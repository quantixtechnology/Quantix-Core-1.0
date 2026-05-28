// ============================================================================
// POST /api/core/storefront/auth/login-password
// Email + password login for storefront customers (Customer-owned credentials).
// Multi-tenant: customer must belong to the specified business.
// Account lockout after 5 consecutive failures (15-min window).
// Body: { email, password, businessId } OR { email, password, businessSlug }
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPassword } from '@/lib/password-utils';
import { createStorefrontSession, normalizeEmail } from '@/lib/storefront-auth';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const window = LOCKOUT_MINUTES * 60 * 1000;
  const entry = rateLimitStore.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + window });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count++;
  return true;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      email: string;
      password: string;
      businessId?: string;
      businessSlug?: string;
    };

    const email = normalizeEmail(body.email || '');
    const { password } = body;

    if (!email || !password) {
      return NextResponse.json({ success: false, error: 'email and password are required' }, { status: 400 });
    }
    if (!body.businessId && !body.businessSlug) {
      return NextResponse.json({ success: false, error: 'businessId or businessSlug is required' }, { status: 400 });
    }

    const business = await db.business.findFirst({
      where: body.businessId ? { id: body.businessId } : { slug: body.businessSlug },
      select: { id: true, name: true, slug: true, status: true },
    });
    if (!business || business.status !== 'ACTIVE') {
      return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 });
    }

    const rlKey = `login-pw:${email}:${business.id}`;
    if (!checkRateLimit(rlKey)) {
      return NextResponse.json({ success: false, error: 'Too many attempts. Please try again later.' }, { status: 429 });
    }

    const customer = await db.customer.findFirst({
      where: { businessId: business.id, email },
      select: {
        id: true, businessId: true, name: true, phone: true,
        passwordHash: true, isPasswordSet: true,
        failedLoginAttempts: true, accountLockedUntil: true,
        mustChangePassword: true, isLoginDisabled: true,
      },
    });

    // Anti-enumeration: generic error for missing customer
    if (!customer) {
      return NextResponse.json({ success: false, error: 'Invalid email or password' }, { status: 401 });
    }

    if (customer.isLoginDisabled) {
      return NextResponse.json(
        { success: false, error: 'Account disabled. Contact the store.' },
        { status: 403 }
      );
    }

    if (customer.accountLockedUntil && customer.accountLockedUntil > new Date()) {
      const minutesLeft = Math.ceil((customer.accountLockedUntil.getTime() - Date.now()) / 60000);
      return NextResponse.json(
        { success: false, error: `Account locked. Try again in ${minutesLeft} minute(s).` },
        { status: 423 }
      );
    }

    if (!customer.isPasswordSet || !customer.passwordHash) {
      return NextResponse.json(
        { success: false, error: 'No password set. Please login with OTP or reset your password.' },
        { status: 400 }
      );
    }

    const isValid = await verifyPassword(password, customer.passwordHash);

    if (!isValid) {
      const newFail = customer.failedLoginAttempts + 1;
      const shouldLock = newFail >= MAX_FAILED_ATTEMPTS;
      await db.customer.update({
        where: { id: customer.id },
        data: {
          failedLoginAttempts: newFail,
          ...(shouldLock ? { accountLockedUntil: new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000) } : {}),
        },
      });
      const attemptsLeft = MAX_FAILED_ATTEMPTS - newFail;
      const msg = shouldLock
        ? `Account locked for ${LOCKOUT_MINUTES} minutes due to too many failed attempts.`
        : `Invalid email or password. ${attemptsLeft} attempt(s) remaining.`;
      return NextResponse.json({ success: false, error: msg }, { status: 401 });
    }

    // Success — reset lockout
    await db.customer.update({
      where: { id: customer.id },
      data: { failedLoginAttempts: 0, accountLockedUntil: null },
    });

    const session = await createStorefrontSession({
      email,
      phone: customer.phone || '',
      name: customer.name,
      businessId: business.id,
      emailVerified: true,
    });

    console.log(`[storefront/auth/login-password] ok email=${email} businessId=${business.id}`);

    return NextResponse.json({ success: true, data: session });
  } catch (error) {
    console.error('[storefront/auth/login-password]', error);
    return NextResponse.json({ success: false, error: 'Login failed' }, { status: 500 });
  }
}
