// ============================================================================
// POST /api/core/storefront/auth/check-customer
//
// Email-first customer existence check — the entry point for the new auth
// flow.  Returns whether a customer exists for this email + businessId pair
// and whether they have a password set.
//
// Security:
//   • Limited PER EMAIL + BUSINESS. There is deliberately NO per-IP ceiling —
//     see the note on the limit below.
//   • Response structure is identical whether exists=true or false (no timing
//     difference that leaks information).
//   • Does NOT reveal whether the email exists in other businesses.
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { normalizeEmail } from '@/lib/storefront-auth';

/**
 * How often ONE address may be asked about, per business, in an hour.
 *
 * There is no per-IP limit here, and that is a decision rather than an
 * oversight. This endpoint was gated on the IP twice — ten checks an hour, then
 * three hundred distinct emails an hour — and both are the same mistake wearing
 * different numbers, because the quantity being capped is not a person.
 *
 * A shop's customers share the shop's Wi-Fi. A carrier's subscribers share the
 * carrier's address. The number of real people behind one IP is unknown and
 * unknowable, so ANY ceiling picked for it eventually turns a paying customer
 * away at the first screen of the login — and the bigger the day, the more
 * certain that becomes. Five hundred people at an opening must all get in.
 *
 * So the limit follows the identity instead: one email, one business. Customer
 * #1 cannot spend Customer #2's allowance, because they do not share one. It
 * stops an address being hammered, and it scales to any number of customers on
 * one network because each brings their own budget.
 *
 * What that costs is stated plainly: this no longer caps how many DIFFERENT
 * addresses a single source may ask about, so it is not by itself a defence
 * against someone working through a list to learn which have accounts here. The
 * IP is still recorded for that — as a signal to investigate with, not a gate
 * that shuts on ordinary customers.
 */
const MAX_CHECKS_PER_EMAIL_PER_HOUR = 30;

export async function POST(request: Request) {
  try {
    // ── Parse + validate ──────────────────────────────────────────────────
    // Before the rate check, because the limit is now about WHICH email is
    // being asked about, not merely how often someone asked.
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

    // ── Rate limit: per email + business, never per IP ────────────────────
    // Recorded, not gated on: an IP is evidence for an investigation, not a
    // reason to refuse the next person on the same Wi-Fi.
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      'unknown';

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const emailKey = `CHECK_CUSTOMER:${businessId}`;

    const recentForThisEmail = await db.oTPCode.count({
      where: { phone: emailKey, email, channel: 'EMAIL_OTP', createdAt: { gte: oneHourAgo } },
    });

    if (recentForThisEmail >= MAX_CHECKS_PER_EMAIL_PER_HOUR) {
      console.warn(`[check-customer] per-email limit hit email=${email} businessId=${businessId} ip=${ip}`);
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    await db.oTPCode.create({
      data: {
        phone: emailKey,
        email,
        code: 'CHECK',
        channel: 'EMAIL_OTP',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    // ── Look up customer by email within this business ────────────────────
    // Check Customer table first (by email + businessId)
    const customer = await db.customer.findFirst({
      where: { businessId, email },
      select: { id: true, isPasswordSet: true, isLoginDisabled: true, passwordHash: true },
    });

    console.log(`[check-customer] email=${email} businessId=${businessId} customer=${JSON.stringify(customer ? { id: customer.id, isPasswordSet: customer.isPasswordSet, hasHash: !!customer.passwordHash } : null)}`);

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
      let hasPassword = customer.isPasswordSet || !!customer.passwordHash;
      if (!hasPassword) {
        const userRow = await db.user.findUnique({
          where:  { email },
          select: { id: true, passwordHash: true },
        });
        console.log(`[check-customer] User lookup email=${email} found=${!!userRow} userHasHash=${!!userRow?.passwordHash}`);
        hasPassword = !!userRow?.passwordHash;
      }

      console.log(`[check-customer] RESULT path=primary exists=true hasPassword=${hasPassword}`);
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
          select: { id: true, isPasswordSet: true, isLoginDisabled: true, email: true, passwordHash: true },
        },
        // Keep BusinessUser for the staff-role guard below
        businessUsers: {
          where: { businessId, isActive: true },
          select: { id: true, role: true },
        },
      },
    });

    console.log(`[check-customer] fallback path email=${email} businessId=${businessId} userFound=${!!user} profiles=${user?.customerProfiles?.length ?? 0} userHasHash=${!!user?.passwordHash}`);

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

        const hasPassword = profile.isPasswordSet || !!profile.passwordHash || !!user.passwordHash;
        console.log(`[check-customer] RESULT path=fallback exists=true hasPassword=${hasPassword} profile.isPasswordSet=${profile.isPasswordSet} profile.hasHash=${!!profile.passwordHash} user.hasHash=${!!user.passwordHash}`);
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
    console.log(`[check-customer] RESULT path=not-found exists=false`);
    return NextResponse.json({ success: true, exists: false, hasPassword: false });
  } catch (error) {
    console.error('[storefront/auth/check-customer]', error);
    return NextResponse.json(
      { success: false, error: 'Check failed' },
      { status: 500 }
    );
  }
}
