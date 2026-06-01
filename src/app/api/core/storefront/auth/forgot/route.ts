// ============================================================================
// POST /api/core/storefront/auth/forgot
// Forgot password — look up customer by email, send OTP to that email.
//
// Updated to accept email directly (aligns with the email-first login flow).
// Phone-based lookup is retained for backward compatibility with any older
// client versions.  When both are provided, email takes priority.
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendEmailOtp } from '@/lib/email-service';
import { maskEmail, normalizeEmail, normalizePhone } from '@/lib/storefront-auth';

const OTP_EXPIRY_MINUTES = 5;
const MAX_OTP_PER_HOUR = 5;

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function getStoreSettings(raw: string | null): Record<string, string> {
  try { return JSON.parse(raw || '{}') } catch { return {} }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      email?: string;
      phone?: string;
      businessId: string;
      storeId?: string;
    };

    const email = normalizeEmail(body.email ?? '');
    const phone = normalizePhone(body.phone ?? '');
    const { businessId, storeId } = body;

    if (!businessId) {
      return NextResponse.json(
        { success: false, error: 'businessId is required' },
        { status: 400 }
      );
    }
    if (!email && !phone) {
      return NextResponse.json(
        { success: false, error: 'email or phone is required' },
        { status: 400 }
      );
    }

    // ── Resolve customer ──────────────────────────────────────────────────
    // Email-first lookup; fall back to phone for backward compatibility.
    let targetEmail: string | null = null;

    if (email) {
      // Validate email format
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json(
          { success: false, error: 'Invalid email format' },
          { status: 400 }
        );
      }

      // Look up customer by email in this business
      const customer = await db.customer.findFirst({
        where: { businessId, email },
        select: { email: true },
      });

      if (customer?.email) {
        targetEmail = customer.email;
      } else {
        // Also try via User table (customer may be linked via userId)
        const user = await db.user.findUnique({
          where: { email },
          select: {
            businessUsers: {
              where: { businessId, isActive: true },
              select: { id: true },
            },
          },
        });
        if (user && user.businessUsers.length > 0) {
          targetEmail = email;
        }
      }
    } else if (phone) {
      // Backward-compatible phone lookup
      const customer = await db.customer.findFirst({
        where: { businessId, phone },
        select: { email: true },
      });
      targetEmail = customer?.email ?? null;
    }

    // Generic response — don't reveal whether account exists
    if (!targetEmail) {
      return NextResponse.json({
        success: true,
        status: 'NOT_FOUND',
        message: 'If an account with this email exists, a recovery code has been sent.',
      });
    }

    const maskedEmail = maskEmail(targetEmail);

    // ── Rate limit ────────────────────────────────────────────────────────
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recent = await db.oTPCode.count({
      where: { email: targetEmail, channel: 'EMAIL_OTP', createdAt: { gte: oneHourAgo } },
    });
    if (recent >= MAX_OTP_PER_HOUR) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please wait before trying again.' },
        { status: 429 }
      );
    }

    // ── Resolve store branding ────────────────────────────────────────────
    let storeName = 'Quantix';
    let otpSenderEmail: string | undefined;
    if (storeId) {
      const store = await db.store.findUnique({
        where: { id: storeId },
        select: { name: true, settings: true, email: true },
      });
      if (store) {
        storeName = store.name;
        const s = getStoreSettings(store.settings);
        otpSenderEmail = s.otpSenderEmail || store.email || undefined;
      }
    } else if (businessId) {
      const biz = await db.business.findUnique({ where: { id: businessId }, select: { name: true } });
      if (biz) storeName = biz.name;
    }

    // ── Create and send OTP ───────────────────────────────────────────────
    const code = generateOTP();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    const existingUser = await db.user.findUnique({ where: { email: targetEmail }, select: { id: true } });
    await db.oTPCode.create({
      data: {
        userId: existingUser?.id ?? null,
        email: targetEmail,
        phone: null,
        code,
        channel: 'EMAIL_OTP',
        expiresAt,
      },
    });

    await sendEmailOtp(targetEmail, code, storeName, otpSenderEmail);

    return NextResponse.json({
      success: true,
      status: 'SENT',
      email: targetEmail,
      maskedEmail,
      message: `Recovery code sent to ${maskedEmail}`,
      ...((process.env.NODE_ENV === 'development') ? { code } : {}),
    });
  } catch (error) {
    console.error('[storefront/auth/forgot]', error);
    return NextResponse.json({ success: false, error: 'Recovery failed' }, { status: 500 });
  }
}
