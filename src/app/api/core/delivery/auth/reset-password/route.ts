// ============================================================================
// POST /api/core/delivery/auth/reset-password
// Admin-initiated password reset for a delivery partner.
// If the partner has no linked User, one is created automatically (requires email).
// Requires CLIENT_OWNER / STORE_MANAGER / QUANTIX_SUPER_ADMIN auth.
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/password-utils';

export const POST = withMiddleware({
  requireAuth: true,
  requiredRoles: ['CLIENT_OWNER', 'STORE_MANAGER', 'QUANTIX_SUPER_ADMIN', 'QUANTIX_SALES_TEAM'],
})(async (req) => {
  try {
    const user = req.user!;
    const body = await req.json() as { partnerId: string; newPassword: string };
    const { partnerId, newPassword } = body;

    if (!partnerId || !newPassword) {
      return NextResponse.json(
        { success: false, error: 'partnerId and newPassword are required' },
        { status: 400 }
      );
    }
    if (newPassword.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    const partner = await db.deliveryPartner.findUnique({ where: { id: partnerId } });
    if (!partner) {
      return NextResponse.json({ success: false, error: 'Delivery partner not found' }, { status: 404 });
    }
    if (!user.isPlatformAdmin && partner.businessId !== user.businessId) {
      return NextResponse.json({ success: false, error: 'Delivery partner not found' }, { status: 404 });
    }

    const hash = await hashPassword(newPassword);

    // Admin-set password → force the partner to choose their own on next login.
    if (partner.userId) {
      // Update existing linked user's password
      await db.user.update({
        where: { id: partner.userId },
        data: { passwordHash: hash, hasPassword: true, authProvider: 'PASSWORD', mustChangePassword: true },
      });
    } else if (partner.email) {
      const email = partner.email.toLowerCase().trim();
      const existingUser = await db.user.findUnique({ where: { email } });

      if (existingUser) {
        // Link to existing user and update password
        await db.user.update({
          where: { id: existingUser.id },
          data: { passwordHash: hash, hasPassword: true, authProvider: 'PASSWORD', mustChangePassword: true },
        });
        const bu = await db.businessUser.findUnique({
          where: { userId_businessId: { userId: existingUser.id, businessId: partner.businessId } },
        });
        if (!bu) {
          await db.businessUser.create({
            data: { userId: existingUser.id, businessId: partner.businessId, role: 'DELIVERY_STAFF', storeId: partner.storeId, isActive: true },
          });
        } else if (partner.storeId) {
          await db.businessUser.update({ where: { id: bu.id }, data: { storeId: partner.storeId } });
        }
        await db.deliveryPartner.update({
          where: { id: partnerId },
          data: { userId: existingUser.id, appEnabled: true },
        });
      } else {
        // Create new User for this partner
        const newUser = await db.user.create({
          data: {
            email,
            name: partner.name,
            phone: partner.phone,
            passwordHash: hash,
            hasPassword: true,
            mustChangePassword: true,
            authProvider: 'PASSWORD',
            isActive: true,
            businessUsers: {
              create: { businessId: partner.businessId, role: 'DELIVERY_STAFF', storeId: partner.storeId, isActive: true },
            },
          },
        });
        await db.deliveryPartner.update({
          where: { id: partnerId },
          data: { userId: newUser.id, appEnabled: true },
        });
      }
    } else {
      return NextResponse.json(
        { success: false, error: 'Partner has no email. Set an email on the partner record first to enable app login.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to reset password';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
