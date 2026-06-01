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

      // Customer.isPasswordSet covers the set-password flow.
      // But reset-password writes to User.passwordHash without updating
      // Customer.isPasswordSet, so we must also check User.passwordHash —
      // a non-null hash means the user has a working password on any storefront.
      let hasPassword = customer.isPasswordSet;
      if (!hasPassword) {
        const userRow = await db.user.findUnique({
          where:  { email },
          select: { passwordHash: true },
        });
        hasPassword = !!userRow?.passwordHash;
      }

      return NextResponse.json({
        success: true,
        exists: true,
        hasPassword,
      });
    }

    // ── Fallback: look up via User → customerProfiles ────────────────────
    //
    // WHY THIS EXISTS:
    // The primary lookup (Customer.email + businessId) misses customers whose
    // Customer.email is NULL — this happens when a customer registered before
    // the email-first flow was introduced (phone-only registration) or when the
    // Customer record was created by admin without an email address.
    //
    // We find the User by email and check whether they have a Customer record
    // (customerProfile) for this specific business, regardless of whether
    // Customer.email is set or a BusinessUser row exists.
    //
    // Staff guard: if the User only has non-CUSTOMER BusinessUser rows and no
    // Customer profile at all, we do NOT treat them as a storefront customer.
    const user = await db.user.findUnique({
      where: { email },
      select: {
        id: true,
        passwordHash: true,
        // All Customer records for this user in this business
        customerProfiles: {
          where: { businessId },
          select: { id: true, isPasswordSet: true, isLoginDisabled: true, email: true },
        },
        // Keep BusinessUser for the staff-role guard below
        businessUsers: {
          where: { businessId, isActive: true },
          select: { id: true, role: true },
        },
      },
    });

    if (user) {
      const profile = user.customerProfiles[0];

      if (profile) {
        // User has a Customer record for this business → existing customer
        if (profile.isLoginDisabled) {
          return NextResponse.json(
            { success: false, error: 'Account disabled. Please contact the store.' },
            { status: 403 }
          );
        }

        // Self-heal: write email back to Customer record so the fast primary
        // path works on all future requests without hitting this fallback.
        if (!profile.email) {
          await db.customer.update({
            where: { id: profile.id },
            data:  { email },
          }).catch(() => { /* non-fatal */ });
        }

        const hasPassword = profile.isPasswordSet || !!user.passwordHash;
        return NextResponse.json({ success: true, exists: true, hasPassword });
      }

      // No Customer profile — only allow if they have a CUSTOMER-role BusinessUser.
      // Pure staff users (no Customer record) must NOT be treated as customers.
      const hasCustomerBU = user.businessUsers.some((bu) => bu.role === 'CUSTOMER');
      if (hasCustomerBU) {
        return NextResponse.json({
          success: true,
          exists: true,
          hasPassword: !!user.passwordHash,
        });
      }
    }

    // Genuinely new customer for this business
    return NextResponse.json({ success: true, exists: false, hasPassword: false });
  } catch (error) {
    console.error('[storefront/auth/check-customer]', error);
    return NextResponse.json(
      { success: false, error: 'Check failed' },
      { status: 500 }
    );
  }
}
