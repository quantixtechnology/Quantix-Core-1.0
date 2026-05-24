// ============================================================================
// QUANTIX CORE — Test Email Endpoint
// POST /api/test-email
//
// Sends a test OTP email using the configured SMTP transport.
// Only available in development or from localhost.
//
// Body: { email, businessName, storeId, otp }
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { sendOTPEmail, isSmtpConfigured } from '@/lib/email-service'

function isAllowed(req: NextRequest): boolean {
  const host = req.headers.get('host') || ''
  const forwarded = req.headers.get('x-forwarded-for') || ''
  const realIp = req.headers.get('x-real-ip') || ''
  const isLocal =
    host.startsWith('localhost') || host.startsWith('127.0.0.1') ||
    forwarded.startsWith('127.') || forwarded.startsWith('::1') ||
    realIp.startsWith('127.') || realIp === '::1'
  return isLocal || process.env.NODE_ENV === 'development'
}

export async function POST(req: NextRequest) {
  if (!isAllowed(req)) {
    return NextResponse.json({ success: false, error: 'Not available in production' }, { status: 403 })
  }

  if (!isSmtpConfigured()) {
    return NextResponse.json({
      success: false,
      error: 'SMTP not configured — set SMTP_HOST, SMTP_USER, SMTP_PASS in .env',
      configured: false,
    }, { status: 503 })
  }

  const body = (await req.json().catch(() => ({}))) as {
    email?: string
    businessName?: string
    storeId?: string
    otp?: string
  }

  const to = body.email?.trim()
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return NextResponse.json({ success: false, error: 'Valid email is required' }, { status: 400 })
  }

  const otp = body.otp || Math.floor(100000 + Math.random() * 900000).toString()
  const businessName = body.businessName || 'Quantix'
  const storeId = body.storeId

  const started = Date.now()
  const result = await sendOTPEmail({ to, otp, businessName, storeId, tenantId: 'TEST' })
  const elapsed = Date.now() - started

  return NextResponse.json({
    success: result.sent,
    ...(result.sent
      ? { message: `Test OTP email delivered to ${to} in ${elapsed}ms`, otp }
      : { error: result.error, otp }
    ),
    smtp: {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      user: process.env.SMTP_USER,
      from: process.env.MAIL_FROM,
    },
  })
}
