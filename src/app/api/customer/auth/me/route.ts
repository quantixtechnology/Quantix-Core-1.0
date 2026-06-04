// ============================================================================
// GET /api/customer/auth/me
// Mobile: get the authenticated customer's profile.
// Requires: Authorization: Bearer <refreshToken>
// Response: { success, user: { id, name, email, phone, avatar, customerId,
//               businessId, loyaltyTier, loyaltyPoints, walletBalance,
//               totalOrders, totalSpent, isPasswordSet, mustChangePassword,
//               isLoginDisabled, lastLoginAt, role } }
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const token = authHeader.slice(7).trim();
    const rt = await db.refreshToken.findUnique({
      where: { token },
      include: {
        user: {
          select: {
            id: true, email: true, name: true, phone: true,
            avatar: true, isActive: true, hasPassword: true,
          },
        },
      },
    });

    if (!rt || rt.expiresAt < new Date() || !rt.user.isActive) {
      return NextResponse.json({ success: false, error: 'Invalid or expired token' }, { status: 401 });
    }

    // x-business-id header is required to scope the profile to the correct tenant.
    // Omitting it would return the first customer record found across any business.
    const businessIdHeader = request.headers.get('x-business-id');
    if (!businessIdHeader) {
      return NextResponse.json({ success: false, error: 'x-business-id header is required' }, { status: 400 });
    }

    const customer = await db.customer.findFirst({
      where: { userId: rt.user.id, businessId: businessIdHeader },
      select: {
        id: true, businessId: true, name: true, email: true, phone: true,
        avatar: true, loyaltyTier: true, loyaltyPoints: true,
        walletBalance: true, totalOrders: true, totalSpent: true,
        isPasswordSet: true, mustChangePassword: true,
        isLoginDisabled: true, lastLoginAt: true,
      },
    });

    if (!customer) {
      return NextResponse.json({ success: false, error: 'Customer profile not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: rt.user.id,
        email: rt.user.email,
        name: customer.name || rt.user.name,
        phone: customer.phone || rt.user.phone || null,
        avatar: customer.avatar || rt.user.avatar || null,
        role: 'CUSTOMER',
        customerId: customer.id,
        businessId: customer.businessId,
        loyaltyTier: customer.loyaltyTier,
        loyaltyPoints: customer.loyaltyPoints,
        walletBalance: customer.walletBalance,
        totalOrders: customer.totalOrders,
        totalSpent: customer.totalSpent,
        isPasswordSet: customer.isPasswordSet,
        mustChangePassword: customer.mustChangePassword,
        isLoginDisabled: customer.isLoginDisabled,
        lastLoginAt: customer.lastLoginAt,
        hasPassword: rt.user.hasPassword,
      },
    });
  } catch (error) {
    console.error('[customer/auth/me]', error);
    return NextResponse.json({ success: false, error: 'Failed to get profile' }, { status: 500 });
  }
}
