// ============================================================================
// QUANTIX CORE — Delivery Partners API
// GET  /api/core/delivery/partners  — List delivery partners (auth required)
// POST /api/core/delivery/partners  — Create delivery partner (CLIENT_OWNER+)
//   When appEnabled=true and password is provided, a User account with role
//   DELIVERY_STAFF is auto-created and linked via userId so the partner can
//   log into the Delivery App.
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { db } from '@/lib/db';
import { hashPassword, generateTempPassword } from '@/lib/password-utils';

export const GET = withMiddleware({ requireAuth: true })(async (req) => {
  try {
    const user = req.user!;
    const { searchParams } = new URL(req.url);

    // Resolve businessId — platform admins must pass it as a query param
    let businessId: string;
    if (user.isPlatformAdmin) {
      const qb = searchParams.get('businessId');
      if (!qb) {
        return NextResponse.json(
          { success: false, error: 'businessId is required' },
          { status: 400 }
        );
      }
      businessId = qb;
    } else {
      if (!user.businessId) {
        return NextResponse.json(
          { success: false, error: 'No business context found for this user' },
          { status: 400 }
        );
      }
      businessId = user.businessId;
    }

    const isOnline = searchParams.get('isOnline');
    const isActive = searchParams.get('isActive');

    const where: Record<string, unknown> = { businessId };
    if (isOnline !== null) where.isOnline = isOnline === 'true';
    if (isActive !== null) where.isActive = isActive === 'true';

    const partners = await db.deliveryPartner.findMany({
      where,
      include: { store: { select: { id: true, name: true, storeCode: true, code: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: partners });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list delivery partners';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});

export const POST = withMiddleware({
  requireAuth: true,
  requiredRoles: ['CLIENT_OWNER', 'QUANTIX_SUPER_ADMIN', 'QUANTIX_SALES_TEAM'],
})(async (req) => {
  try {
    const user = req.user!;
    const body = await req.json();

    if (!body.name) {
      return NextResponse.json({ success: false, error: 'name is required' }, { status: 400 });
    }
    if (!body.phone) {
      return NextResponse.json({ success: false, error: 'phone is required' }, { status: 400 });
    }

    const businessId: string = user.isPlatformAdmin
      ? (body.businessId ?? user.businessId ?? '')
      : (user.businessId ?? '');

    if (!businessId) {
      return NextResponse.json({ success: false, error: 'businessId is required' }, { status: 400 });
    }

    // Assigned store is mandatory — it scopes the partner's app access to a single
    // store (orders/customers/deliveries). Validate it belongs to this business.
    if (!body.storeId) {
      return NextResponse.json({ success: false, error: 'Assigned store is required' }, { status: 400 });
    }
    const store = await db.store.findFirst({
      where: { id: body.storeId as string, businessId },
      select: { id: true },
    });
    if (!store) {
      return NextResponse.json(
        { success: false, error: 'Assigned store not found for this business' },
        { status: 400 }
      );
    }

    // App Access requires an email so the partner can log in with email + password
    // (the unified Quantix auth flow). The password itself is optional — when
    // omitted we generate a temporary one and force a change on first login.
    if (body.appEnabled && !body.email) {
      return NextResponse.json(
        { success: false, error: 'email is required when App Access is enabled' },
        { status: 400 }
      );
    }

    const existing = await db.deliveryPartner.findUnique({
      where: { businessId_phone: { businessId, phone: body.phone } },
    });
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'A delivery partner with this phone number already exists' },
        { status: 409 }
      );
    }

    // Generate partner code: DP-YYYYMM-NNNN
    const now = new Date();
    const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const count = await db.deliveryPartner.count({ where: { businessId } });
    const partnerCode = `DP-${ym}-${String(count + 1).padStart(4, '0')}`;

    // Resolve userId — create a linked User account when appEnabled + email.
    // Password is optional: when not supplied we mint a temp password and force
    // a change on first login (returned once for the admin to share).
    let linkedUserId: string | undefined = body.userId ?? undefined;
    let tempPassword: string | undefined;

    if (body.appEnabled && body.email) {
      const email = (body.email as string).toLowerCase().trim();

      if (body.password && (body.password as string).length < 6) {
        return NextResponse.json(
          { success: false, error: 'Password must be at least 6 characters' },
          { status: 400 }
        );
      }

      // Admin-typed password → use as-is (no forced change). No password → temp
      // password + forced rotation on first login.
      const usingTemp = !body.password;
      const plainPassword = (body.password as string) || generateTempPassword();
      if (usingTemp) tempPassword = plainPassword;

      const hash = await hashPassword(plainPassword);
      const existingUser = await db.user.findUnique({ where: { email } });

      if (existingUser) {
        // Link existing user and ensure they have DELIVERY_STAFF for this business
        await db.user.update({
          where: { id: existingUser.id },
          data: { passwordHash: hash, hasPassword: true, authProvider: 'PASSWORD', mustChangePassword: usingTemp },
        });
        const bu = await db.businessUser.findUnique({
          where: { userId_businessId: { userId: existingUser.id, businessId } },
        });
        if (!bu) {
          await db.businessUser.create({
            data: { userId: existingUser.id, businessId, role: 'DELIVERY_STAFF', storeId: body.storeId, isActive: true },
          });
        } else {
          // Keep the linked BusinessUser's store in sync (drives middleware store scoping)
          await db.businessUser.update({
            where: { id: bu.id },
            data: { storeId: body.storeId },
          });
        }
        linkedUserId = existingUser.id;
      } else {
        const newUser = await db.user.create({
          data: {
            email,
            name: body.name as string,
            phone: body.phone as string,
            passwordHash: hash,
            hasPassword: true,
            mustChangePassword: usingTemp,
            authProvider: 'PASSWORD',
            isActive: true,
            businessUsers: {
              create: { businessId, role: 'DELIVERY_STAFF', storeId: body.storeId, isActive: true },
            },
          },
        });
        linkedUserId = newUser.id;
      }
    }

    const partner = await db.deliveryPartner.create({
      data: {
        businessId,
        userId: linkedUserId,
        storeId: body.storeId,
        name: body.name,
        phone: body.phone,
        email: body.email,
        avatar: body.avatar,
        vehicleType: body.vehicleType,
        vehicleNumber: body.vehicleNumber,
        licenseNumber: body.licenseNumber,
        isOnline: body.isOnline || body.availability === 'ONLINE' || false,
        isActive: body.isActive !== false,
        currentLat: body.currentLat,
        currentLng: body.currentLng,
        fcmToken: body.fcmToken,
        bankAccount: body.bankAccount,
        partnerCode,
        partnerType: body.partnerType || 'INTERNAL',
        availability: body.availability || 'OFFLINE',
        appEnabled: body.appEnabled || false,
        notes: body.notes,
      },
    });

    return NextResponse.json(
      {
        success: true,
        // tempPassword is surfaced ONCE so the admin can share it with the partner.
        // It is never stored in plaintext — only the bcrypt hash is persisted.
        data: { ...partner, tempPassword },
        message: 'Delivery partner created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create delivery partner';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
