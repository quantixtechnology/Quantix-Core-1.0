// ============================================================================
// POST /api/core/storefront/auth/check
// Check phone existence before OTP — returns NEW / LOGIN / CONFLICT
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { maskEmail, normalizeEmail, normalizePhone } from '@/lib/storefront-auth';

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      phone: string;
      email: string;
      businessId: string;
    };

    const { businessId } = body;
    const phone = normalizePhone(body.phone || '');
    const email = normalizeEmail(body.email || '');

    if (!phone || !email || !businessId) {
      return NextResponse.json(
        { success: false, error: 'phone, email and businessId are required' },
        { status: 400 }
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Look up customer by phone within this business
    const existing = await db.customer.findFirst({
      where: { businessId, phone },
      select: { email: true, verified: true },
    });

    if (!existing) {
      // Also check if there's a User with this email already registered at this business
      const existingUser = await db.user.findUnique({ where: { email } });
      if (existingUser) {
        const existingBU = await db.businessUser.findFirst({
          where: { userId: existingUser.id, businessId },
        });
        const existingCustomer = existingBU
          ? await db.customer.findFirst({ where: { userId: existingUser.id, businessId } })
          : null;
        if (existingCustomer?.phone && existingCustomer.phone !== phone) {
          return NextResponse.json({
            success: true,
            status: 'EMAIL_TAKEN',
            message: 'This email is registered with a different phone number.',
          });
        }
      }
      return NextResponse.json({ success: true, status: 'NEW' });
    }

    const storedEmail = existing.email ? normalizeEmail(existing.email) : null;

    if (!storedEmail || storedEmail === email) {
      // Same or no email stored — allow login
      return NextResponse.json({
        success: true,
        status: 'LOGIN',
        maskedEmail: storedEmail ? maskEmail(storedEmail) : maskEmail(email),
        message: 'Welcome back! Verification code will be sent to your email.',
      });
    }

    // Email mismatch — block with masked hint
    return NextResponse.json({
      success: true,
      status: 'CONFLICT',
      maskedEmail: maskEmail(storedEmail),
      message: 'An account with this phone already exists but with a different email.',
    });
  } catch (error) {
    console.error('[storefront/auth/check]', error);
    return NextResponse.json({ success: false, error: 'Check failed' }, { status: 500 });
  }
}
