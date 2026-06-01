// ============================================================================
// POST /api/core/storefront/auth/verify
// Verify EMAIL OTP → create session (storefront customers only)
//
// otpPurpose values:
//   "register" — first-time customer; name AND phone are required fields.
//   "login"    — existing customer; name/phone come from existing record.
//   "forgot"   — password recovery; name/phone not needed.
//
// IMPORTANT: The email-as-name fallback (email.split('@')[0]) has been
// permanently removed.  A customer record is NEVER created with a name
// derived from the email address.  The name must be explicitly provided
// for new registrations or come from the existing customer record.
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createStorefrontSession, normalizeEmail, normalizePhone } from '@/lib/storefront-auth';

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      email: string;
      phone?: string;
      code: string;
      name?: string;
      businessId: string;
      storeId?: string;
      otpPurpose?: 'register' | 'login' | 'forgot';
    };

    const email      = normalizeEmail(body.email ?? '');
    const phone      = normalizePhone(body.phone ?? '');
    const name       = (body.name ?? '').trim();
    const { code, businessId, storeId } = body;
    const purpose    = body.otpPurpose ?? 'login';

    // ── Validate required base fields ─────────────────────────────────────
    if (!email || !code || !businessId) {
      return NextResponse.json(
        { success: false, error: 'email, code and businessId are required' },
        { status: 400 }
      );
    }

    // ── Enforce registration fields ───────────────────────────────────────
    // For new customer registration: name and phone are mandatory.
    // This prevents the email-as-name anti-pattern completely.
    if (purpose === 'register') {
      if (!name) {
        return NextResponse.json(
          { success: false, error: 'Full name is required' },
          { status: 400 }
        );
      }
      if (name.length < 2) {
        return NextResponse.json(
          { success: false, error: 'Name must be at least 2 characters' },
          { status: 400 }
        );
      }
      if (!phone) {
        return NextResponse.json(
          { success: false, error: 'Mobile number is required' },
          { status: 400 }
        );
      }
    }

    // ── Find valid OTP ────────────────────────────────────────────────────
    const otpRecord = await db.oTPCode.findFirst({
      where: {
        email,
        code,
        channel: 'EMAIL_OTP',
        isVerified: false,
        expiresAt: { gte: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired verification code' },
        { status: 401 }
      );
    }

    // ── Mark OTP used ─────────────────────────────────────────────────────
    await db.oTPCode.update({
      where: { id: otpRecord.id },
      data: { isVerified: true, verifiedAt: new Date() },
    });

    // ── Check login-disabled flag ─────────────────────────────────────────
    const existingCustomer = await db.customer.findFirst({
      where: { businessId, email },
      select: { isLoginDisabled: true, name: true, phone: true },
    });

    if (existingCustomer?.isLoginDisabled) {
      return NextResponse.json(
        { success: false, error: 'Account disabled. Contact the store.' },
        { status: 403 }
      );
    }

    // ── Resolve name for non-registration purposes ────────────────────────
    // For login/forgot: use the name from the existing customer record.
    // Never fall back to the email address or email username.
    let resolvedName = name;
    if (!resolvedName && (purpose === 'login' || purpose === 'forgot')) {
      resolvedName = existingCustomer?.name ?? '';
    }

    // At this point, if resolvedName is still empty we refuse — a customer
    // record with a blank name should never be created or updated.
    if (!resolvedName) {
      return NextResponse.json(
        { success: false, error: 'Customer name could not be resolved. Please register first.' },
        { status: 400 }
      );
    }

    // Resolve phone for non-registration purposes similarly
    const resolvedPhone = phone || (purpose !== 'register' ? (existingCustomer?.phone ?? '') : '');

    // ── Create session ────────────────────────────────────────────────────
    const session = await createStorefrontSession({
      email,
      phone: resolvedPhone,
      name: resolvedName,
      businessId,
      storeId,
      emailVerified: true,
      otpPurpose: purpose,
    });

    return NextResponse.json({ success: true, data: session });
  } catch (error) {
    console.error('[storefront/auth/verify]', error);
    return NextResponse.json({ success: false, error: 'Verification failed' }, { status: 500 });
  }
}
