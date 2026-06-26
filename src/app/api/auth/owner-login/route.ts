// ============================================================================
// POST /api/auth/owner-login
// Initialize owner login with OTP or password reset
// ============================================================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import crypto from 'crypto'

export async function POST(req: Request) {
  try {
    const { email } = await req.json()

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      )
    }

    // Find user by email
    const user = await db.user.findUnique({
      where: { email },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'No account found for this email' },
        { status: 404 }
      )
    }

    // Check if user has a business
    const businessUser = await db.businessUser.findFirst({
      where: { userId: user.id, role: 'CLIENT_OWNER' },
      include: { business: true },
    })

    if (!businessUser) {
      return NextResponse.json(
        { success: false, error: 'User is not a business owner' },
        { status: 403 }
      )
    }

    // Generate OTP (6 digits)
    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    const otpExpiry = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes

    // Store OTP
    await db.oTPCode.create({
      data: {
        userId: user.id,
        email: user.email,
        code: otp,
        channel: 'EMAIL_OTP',
        expiresAt: otpExpiry,
      },
    })

    // TODO: Send OTP via email (SMTP)
    console.log(`[DEV] OTP for ${email}: ${otp}`)

    return NextResponse.json({
      success: true,
      data: {
        email: user.email,
        businessId: businessUser.businessId,
        businessName: businessUser.business.name,
        message: 'OTP sent to email',
      },
    })
  } catch (error) {
    console.error('[auth/owner-login] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to initialize login',
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/auth/owner-login/verify
 * Verify OTP and create session
 */
export async function PUT(req: Request) {
  try {
    const { email, otp } = await req.json()

    if (!email || !otp) {
      return NextResponse.json(
        { success: false, error: 'Email and OTP are required' },
        { status: 400 }
      )
    }

    // Find user by email
    const user = await db.user.findUnique({
      where: { email },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Find and verify OTP
    const otpRecord = await db.oTPCode.findFirst({
      where: {
        userId: user.id,
        code: otp,
        isVerified: false,
        expiresAt: { gt: new Date() },
      },
    })

    if (!otpRecord) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired OTP' },
        { status: 401 }
      )
    }

    // Mark OTP as verified
    await db.oTPCode.update({
      where: { id: otpRecord.id },
      data: {
        isVerified: true,
        verifiedAt: new Date(),
      },
    })

    // Update last login
    await db.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
      },
    })

    // Get business info
    const businessUser = await db.businessUser.findFirst({
      where: { userId: user.id, role: 'CLIENT_OWNER' },
      include: { business: true },
    })

    return NextResponse.json({
      success: true,
      data: {
        userId: user.id,
        email: user.email,
        name: user.name,
        businessId: businessUser?.businessId,
        businessName: businessUser?.business.name,
        // TODO: Create JWT session token
        sessionToken: 'temp-jwt-token',
      },
    })
  } catch (error) {
    console.error('[auth/owner-login/verify] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to verify OTP',
      },
      { status: 500 }
    )
  }
}
