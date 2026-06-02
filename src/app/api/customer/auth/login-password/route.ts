// ============================================================================
// POST /api/customer/auth/login-password
// Mobile customer: login with email + password.
// Returns FLAT response consistent with verify-otp.
//
// Request:  { email, password, businessId } OR { email, password, businessSlug }
// Response: { success, token, refreshToken, user, customerId, isPasswordSet,
//             mustChangePassword, businesses }
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPassword } from '@/lib/password-utils';
import { createStorefrontSession, normalizeEmail } from '@/lib/storefront-auth';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

const rlStore = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(key: string): boolean {
  const now = Date.now(), win = LOCKOUT_MINUTES * 60 * 1000;
  const e = rlStore.get(key);
  if (!e || now > e.resetAt) { rlStore.set(key, { count: 1, resetAt: now + win }); return true; }
  if (e.count >= 10) return false;
  e.count++; return true;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      email: string; password: string; businessId?: string; businessSlug?: string;
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
    if (!business) {
      return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 });
    }

    if (!checkRateLimit(`lp:${email}:${business.id}`)) {
      return NextResponse.json({ success: false, error: 'Too many attempts. Try again later.' }, { status: 429 });
    }

    const customer = await db.customer.findFirst({
      where: { businessId: business.id, email },
      select: {
        id: true, name: true, phone: true,
        passwordHash: true, isPasswordSet: true,
        failedLoginAttempts: true, accountLockedUntil: true,
        mustChangePassword: true, isLoginDisabled: true,
      },
    });
    if (!customer) {
      return NextResponse.json({ success: false, error: 'Invalid email or password' }, { status: 401 });
    }
    if (customer.isLoginDisabled) {
      return NextResponse.json({ success: false, error: 'Account disabled. Contact the store.' }, { status: 403 });
    }
    if (customer.accountLockedUntil && customer.accountLockedUntil > new Date()) {
      const min = Math.ceil((customer.accountLockedUntil.getTime() - Date.now()) / 60000);
      return NextResponse.json({ success: false, error: `Account locked. Try again in ${min} minute(s).` }, { status: 423 });
    }
    // Fall back to User.passwordHash for accounts where password was set on a
    // different storefront (set-password only wrote to that Customer record;
    // User.passwordHash is the shared cross-storefront credential).
    let effectiveHash = customer.passwordHash;
    if (!effectiveHash) {
      const userRow = await db.user.findUnique({
        where: { email },
        select: { passwordHash: true },
      });
      effectiveHash = userRow?.passwordHash ?? null;
    }

    if (!effectiveHash) {
      return NextResponse.json(
        { success: false, error: 'No password set. Login with OTP or reset your password.' },
        { status: 400 }
      );
    }

    const isValid = await verifyPassword(password, effectiveHash);
    if (!isValid) {
      const fails = customer.failedLoginAttempts + 1;
      const lock = fails >= MAX_FAILED_ATTEMPTS;
      await db.customer.update({
        where: { id: customer.id },
        data: {
          failedLoginAttempts: fails,
          ...(lock ? { accountLockedUntil: new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000) } : {}),
        },
      });
      const msg = lock
        ? `Account locked for ${LOCKOUT_MINUTES} minutes.`
        : `Invalid email or password. ${MAX_FAILED_ATTEMPTS - fails} attempt(s) remaining.`;
      return NextResponse.json({ success: false, error: msg }, { status: 401 });
    }

    await db.customer.update({
      where: { id: customer.id },
      data: { failedLoginAttempts: 0, accountLockedUntil: null },
    });

    const session = await createStorefrontSession({
      email, phone: customer.phone || '', name: customer.name,
      businessId: business.id, emailVerified: true,
    });

    return NextResponse.json({
      success: true,
      token: session.refreshToken,
      refreshToken: session.refreshToken,
      user: session.user,
      customerId: session.customerId,
      isPasswordSet: session.isPasswordSet,
      mustChangePassword: session.mustChangePassword,
      businesses: session.businesses,
    });
  } catch (error) {
    console.error('[customer/auth/login-password]', error);
    return NextResponse.json({ success: false, error: 'Login failed' }, { status: 500 });
  }
}
