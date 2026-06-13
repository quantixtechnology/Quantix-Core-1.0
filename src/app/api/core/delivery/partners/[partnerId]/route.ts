// ============================================================================
// QUANTIX CORE — Delivery Partner Detail API
// GET    /api/core/delivery/partners/[partnerId] — Get single partner (auth required)
// PATCH  /api/core/delivery/partners/[partnerId] — Update partner (CLIENT_OWNER+)
// DELETE /api/core/delivery/partners/[partnerId] — Soft delete partner (CLIENT_OWNER+)
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { db } from '@/lib/db';
import { hashPassword, generateTempPassword } from '@/lib/password-utils';

export const GET = withMiddleware({ requireAuth: true })(async (req, context) => {
  try {
    const params = await context?.params;
    const partnerId = params?.partnerId as string;

    if (!partnerId) {
      return NextResponse.json({ success: false, error: 'Invalid partner ID' }, { status: 400 });
    }

    const user = req.user!;
    const partner = await db.deliveryPartner.findUnique({
      where: { id: partnerId },
      include: { store: { select: { id: true, name: true } } },
    });

    if (!partner) {
      return NextResponse.json({ success: false, error: 'Delivery partner not found' }, { status: 404 });
    }

    // Verify partner belongs to user's business
    if (!user.isPlatformAdmin && partner.businessId !== user.businessId) {
      return NextResponse.json({ success: false, error: 'Delivery partner not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: partner });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get delivery partner';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});

export const PATCH = withMiddleware({ requireAuth: true, requiredRoles: ['CLIENT_OWNER', 'STORE_MANAGER', 'QUANTIX_SUPER_ADMIN', 'QUANTIX_SALES_TEAM'] })(async (req, context) => {
  try {
    const params = await context?.params;
    const partnerId = params?.partnerId as string;

    if (!partnerId) {
      return NextResponse.json({ success: false, error: 'Invalid partner ID' }, { status: 400 });
    }

    const user = req.user!;
    const existing = await db.deliveryPartner.findUnique({ where: { id: partnerId } });

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Delivery partner not found' }, { status: 404 });
    }

    // Verify partner belongs to user's business
    if (!user.isPlatformAdmin && existing.businessId !== user.businessId) {
      return NextResponse.json({ success: false, error: 'Delivery partner not found' }, { status: 404 });
    }

    const body = await req.json();

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.email !== undefined) updateData.email = body.email;
    if (body.vehicleType !== undefined) updateData.vehicleType = body.vehicleType;
    if (body.vehicleNumber !== undefined) updateData.vehicleNumber = body.vehicleNumber;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;
    if (body.phone !== undefined) updateData.phone = body.phone;
    if (body.avatar !== undefined) updateData.avatar = body.avatar;
    if (body.licenseNumber !== undefined) updateData.licenseNumber = body.licenseNumber;
    if (body.isOnline !== undefined) updateData.isOnline = body.isOnline;
    if (body.currentLat !== undefined) updateData.currentLat = body.currentLat;
    if (body.currentLng !== undefined) updateData.currentLng = body.currentLng;
    if (body.fcmToken !== undefined) updateData.fcmToken = body.fcmToken;
    if (body.bankAccount !== undefined) updateData.bankAccount = body.bankAccount;
    if (body.partnerType !== undefined) updateData.partnerType = body.partnerType;
    if (body.availability !== undefined) updateData.availability = body.availability;
    if (body.appEnabled !== undefined) updateData.appEnabled = body.appEnabled;
    if (body.notes !== undefined) updateData.notes = body.notes;

    if (body.phone && body.phone !== existing.phone) {
      const phoneInUse = await db.deliveryPartner.findUnique({
        where: { businessId_phone: { businessId: existing.businessId, phone: body.phone } },
      });
      if (phoneInUse) {
        return NextResponse.json(
          { success: false, error: 'A delivery partner with this phone number already exists for this business' },
          { status: 409 }
        );
      }
    }

    // Store reassignment — validate it belongs to the partner's business and keep
    // the linked BusinessUser.storeId in sync (this drives middleware store scoping).
    let storeChanged = false;
    if (body.storeId !== undefined && body.storeId !== existing.storeId) {
      if (body.storeId) {
        const store = await db.store.findFirst({
          where: { id: body.storeId as string, businessId: existing.businessId },
          select: { id: true },
        });
        if (!store) {
          return NextResponse.json(
            { success: false, error: 'Assigned store not found for this business' },
            { status: 400 }
          );
        }
      }
      updateData.storeId = body.storeId || null;
      storeChanged = true;
    }

    // Enable App Access on an existing partner (e.g. legacy phone-only partner) —
    // mint or link a DELIVERY_STAFF User and issue a temporary password.
    let tempPassword: string | undefined;
    const enablingApp = body.appEnabled === true && !existing.userId;
    if (enablingApp) {
      const email = (body.email || existing.email || '') as string;
      if (!email) {
        return NextResponse.json(
          { success: false, error: 'email is required to enable App Access' },
          { status: 400 }
        );
      }
      const storeId = (body.storeId ?? existing.storeId) as string | null;
      if (!storeId) {
        return NextResponse.json(
          { success: false, error: 'Assigned store is required to enable App Access' },
          { status: 400 }
        );
      }
      const normEmail = email.toLowerCase().trim();
      const plain = (body.password as string) || generateTempPassword();
      const usingTemp = !body.password;
      if (usingTemp) tempPassword = plain;
      const hash = await hashPassword(plain);

      const existingUser = await db.user.findUnique({ where: { email: normEmail } });
      if (existingUser) {
        await db.user.update({
          where: { id: existingUser.id },
          data: { passwordHash: hash, hasPassword: true, authProvider: 'PASSWORD', mustChangePassword: usingTemp },
        });
        const bu = await db.businessUser.findUnique({
          where: { userId_businessId: { userId: existingUser.id, businessId: existing.businessId } },
        });
        if (!bu) {
          await db.businessUser.create({
            data: { userId: existingUser.id, businessId: existing.businessId, role: 'DELIVERY_STAFF', storeId, isActive: true },
          });
        } else {
          await db.businessUser.update({ where: { id: bu.id }, data: { storeId } });
        }
        updateData.userId = existingUser.id;
      } else {
        const newUser = await db.user.create({
          data: {
            email: normEmail,
            name: (body.name || existing.name) as string,
            phone: (body.phone || existing.phone) as string,
            passwordHash: hash,
            hasPassword: true,
            mustChangePassword: usingTemp,
            authProvider: 'PASSWORD',
            isActive: true,
            businessUsers: { create: { businessId: existing.businessId, role: 'DELIVERY_STAFF', storeId, isActive: true } },
          },
        });
        updateData.userId = newUser.id;
      }
    } else if (storeChanged && existing.userId) {
      // Partner already has a linked user — sync their BusinessUser.storeId too.
      const bu = await db.businessUser.findUnique({
        where: { userId_businessId: { userId: existing.userId, businessId: existing.businessId } },
      });
      if (bu) await db.businessUser.update({ where: { id: bu.id }, data: { storeId: body.storeId || null } });
    }

    const updated = await db.deliveryPartner.update({ where: { id: partnerId }, data: updateData });

    return NextResponse.json({
      success: true,
      data: { ...updated, tempPassword },
      message: 'Delivery partner updated successfully',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update delivery partner';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});

// PUT is an alias for PATCH — accept both from the admin UI
export { PATCH as PUT }

export const DELETE = withMiddleware({ requireAuth: true, requiredRoles: ['CLIENT_OWNER', 'QUANTIX_SUPER_ADMIN', 'QUANTIX_SALES_TEAM'] })(async (req, context) => {
  try {
    const params = await context?.params;
    const partnerId = params?.partnerId as string;

    if (!partnerId) {
      return NextResponse.json({ success: false, error: 'Invalid partner ID' }, { status: 400 });
    }

    const user = req.user!;
    const existing = await db.deliveryPartner.findUnique({ where: { id: partnerId } });

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Delivery partner not found' }, { status: 404 });
    }

    if (!user.isPlatformAdmin && existing.businessId !== user.businessId) {
      return NextResponse.json({ success: false, error: 'Delivery partner not found' }, { status: 404 });
    }

    await db.deliveryPartner.update({ where: { id: partnerId }, data: { isActive: false } });

    return NextResponse.json({ success: true, message: 'Delivery partner deactivated successfully' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to deactivate delivery partner';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
