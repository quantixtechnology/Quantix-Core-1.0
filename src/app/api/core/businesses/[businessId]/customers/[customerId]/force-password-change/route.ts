// ============================================================================
// POST /api/core/businesses/[businessId]/customers/[customerId]/force-password-change
// Admin: mark customer as requiring a password change on next login.
// Sets mustChangePassword=true. Customer is redirected to change password after login.
// Requires: CLIENT_OWNER or STORE_MANAGER role.
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { db } from '@/lib/db';

export const POST = withMiddleware({ requireAuth: true })(async (req, context) => {
  try {
    const params = await context?.params;
    const businessId = params?.businessId as string;
    const customerId = params?.customerId as string;

    if (!businessId || !customerId) {
      return NextResponse.json({ success: false, error: 'businessId and customerId are required' }, { status: 400 });
    }

    const actor = req.user!;
    const allowedRoles = ['CLIENT_OWNER', 'STORE_MANAGER', 'QUANTIX_SUPER_ADMIN', 'PLATFORM_ADMIN'];
    if (!actor.isPlatformAdmin && actor.businessId !== businessId) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }
    if (!actor.isPlatformAdmin && !allowedRoles.includes(actor.role)) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const customer = await db.customer.findFirst({
      where: { id: customerId, businessId },
      select: { id: true, email: true, isPasswordSet: true },
    });
    if (!customer) {
      return NextResponse.json({ success: false, error: 'Customer not found' }, { status: 404 });
    }
    if (!customer.isPasswordSet) {
      return NextResponse.json(
        { success: false, error: 'Customer has no password set — use Send Reset Link instead' },
        { status: 400 }
      );
    }

    await db.customer.update({
      where: { id: customerId },
      data: { mustChangePassword: true },
    });

    console.log(`[admin/force-password-change] actorId=${actor.id} customerId=${customerId} businessId=${businessId}`);

    await db.activityLog.create({
      data: {
        userId: actor.id,
        action: 'admin.customer_force_password_change',
        entity: 'Customer',
        entityId: customerId,
        details: JSON.stringify({ businessId, customerEmail: customer.email }),
      },
    }).catch(() => null);

    return NextResponse.json({ success: true, message: 'Customer will be required to change password on next login.' });
  } catch (error) {
    console.error('[admin/customers/force-password-change]', error);
    return NextResponse.json({ success: false, error: 'Failed to set force password change' }, { status: 500 });
  }
});
