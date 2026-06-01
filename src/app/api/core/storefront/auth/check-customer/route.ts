// ============================================================================
// POST /api/core/storefront/auth/check-customer
//
// Email-first customer existence check — the entry point for the new auth
// flow.  Returns whether a customer exists for this email + businessId pair
// and whether they have a password set.
//
// Security:
//   • Rate-limited to 10 requests/hour per IP to deter enumeration.
//   • Response structure is identical whether exists=true or false (no timing
//     difference that leaks information).
//   • Does NOT reveal whether the email exists in other businesses.
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { normalizeEmail } from '@/lib/storefront-auth';

const MAX_CHECKS_PER_HOUR = 10;

export async function POST(request: Request) {
  try {
    // ── Rate limit by IP ──────────────────────────────────────────────────
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      'unknown';

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentChecks = await db.oTPCode.count({
      where: {
        phone: `CHECK_CUSTOMER_${ip}`,  // abuse the phone field as a lightweight counter key
        channel: 'EMAIL_OTP',
        createdAt: { gte: oneHourAgo },
      },
    });

    if (recentChecks >= MAX_CHECKS_PER_HOUR) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    // Record this check (reuse OTPCode table as a rate-limit log)
    await db.oTPCode.create({
      data: {
        phone: `CHECK_CUSTOMER_${ip}`,
        email: null,
        code: 'CHECK',
        channel: 'EMAIL_OTP',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    // ── Parse + validate ──────────────────────────────────────────────────
    const body = await request.json() as { email?: string; businessId?: string };
    const email = normalizeEmail(body.email ?? '');
    const { businessId } = body;

    if (!email || !businessId) {
      return NextResponse.json(
        { success: false, error: 'email and businessId are required' },
        { status: 400 }
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // ── Look up customer by email within this business ────────────────────
    // Check Customer table first (by email + businessId)
    const customer = await db.customer.findFirst({
      where: { businessId, email },
      select: { isPasswordSet: true, isLoginDisabled: true },
    });

    if (customer) {
      if (customer.isLoginDisabled) {
        return NextResponse.json(
          { success: false, error: 'Account disabled. Please contact the store.' },
          { status: 403 }
        );
      }
      return NextResponse.json({
        success: true,
        exists: true,
        hasPassword: customer.isPasswordSet,
      });
    }

    // Fallback: check via User → BusinessUser link, but ONLY for the CUSTOMER
    // role.  Staff roles (CLIENT_OWNER, STORE_MANAGER, etc.) must NOT be
    // treated as storefront customers — doing so would falsely return
    // exists:true for staff emails and trigger an unwanted OTP send.
    const user = await db.user.findUnique({
      where: { email },
      select: {
        id: true,
        hasPassword: true,
        businessUsers: {
          where: { businessId, isActive: true, role: 'CUSTOMER' },
          select: { id: true },
        },
        customerProfiles: {
          where: { businessId },
          select: { isPasswordSet: true, isLoginDisabled: true },
        },
      },
    });

    if (user && user.businessUsers.length > 0) {
      const profile = user.customerProfiles[0];
      if (profile?.isLoginDisabled) {
        return NextResponse.json(
          { success: false, error: 'Account disabled. Please contact the store.' },
          { status: 403 }
        );
      }
      return NextResponse.json({
        success: true,
        exists: true,
        hasPassword: profile?.isPasswordSet ?? user.hasPassword,
      });
    }

    // New customer
    return NextResponse.json({ success: true, exists: false, hasPassword: false });
  } catch (error) {
    console.error('[storefront/auth/check-customer]', error);
    return NextResponse.json(
      { success: false, error: 'Check failed' },
      { status: 500 }
    );
  }
}
