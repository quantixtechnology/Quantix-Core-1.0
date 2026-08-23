// ============================================================================
// POST /api/core/storefront/auth/check-customer
//
// Email-first customer existence check — the entry point for the new auth
// flow.  Returns whether a customer exists for this email + businessId pair
// and whether they have a password set.
//
// Security:
//   • Rate-limited per IP on the number of DISTINCT emails checked, to deter
//     enumeration — see below for why it counts distinct rather than total.
//   • Response structure is identical whether exists=true or false (no timing
//     difference that leaks information).
//   • Does NOT reveal whether the email exists in other businesses.
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { normalizeEmail } from '@/lib/storefront-auth';

/**
 * Distinct email addresses one IP may ask about in an hour.
 *
 * This used to count TOTAL checks, at ten an hour, which locked out whole
 * regions: an Indian ISP puts thousands of subscribers behind one public
 * address (CGNAT), so ten sign-in attempts across all of them and every
 * customer on that carrier was refused at the email box — the first screen of
 * the login. They had done nothing wrong and had no way round it.
 *
 * Counting DISTINCT emails is both kinder and a better signal. Enumeration is
 * asking about MANY addresses; a real customer asks about one, however many
 * times they retype it. So a shared address carries hundreds of legitimate
 * sign-ins, while someone probing a list still stops here.
 */
const MAX_DISTINCT_EMAILS_PER_HOUR = 40;

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

    // ── Rate limit: distinct emails per IP ────────────────────────────────
    // After validation, so a junk address cannot spend a slot in the budget.
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      'unknown';

    const ipKey = `CHECK_CUSTOMER_${ip}`;
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    if (email) {
      // Has this address already been asked about from here? If so it is the
      // same person retrying, and it reveals nothing new — so it costs nothing
      // and writes nothing.
      const repeat = await db.oTPCode.findFirst({
        where: { phone: ipKey, email, channel: 'EMAIL_OTP', createdAt: { gte: oneHourAgo } },
        select: { id: true },
      });

      if (!repeat) {
        const distinct = await db.oTPCode.findMany({
          where: { phone: ipKey, channel: 'EMAIL_OTP', createdAt: { gte: oneHourAgo } },
          select: { email: true },
          distinct: ['email'],
        });

        if (distinct.length >= MAX_DISTINCT_EMAILS_PER_HOUR) {
          return NextResponse.json(
            { success: false, error: 'Too many requests. Please try again later.' },
            { status: 429 }
          );
        }

        // Record the address, not just the fact of a check — the count above
        // depends on knowing which ones have been seen.
        await db.oTPCode.create({
          data: {
            phone: ipKey,
            email,
            code: 'CHECK',
            channel: 'EMAIL_OTP',
            expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          },
        });
      }
    }

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
