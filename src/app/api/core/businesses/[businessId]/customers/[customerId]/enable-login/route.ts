// ============================================================================
// POST /api/core/businesses/[businessId]/customers/[customerId]/enable-login
// Admin: re-enable login for a customer whose login was previously disabled.
// Clears isLoginDisabled and any account lockout.
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
      select: { id: true, email: true, isLoginDisabled: true },
    });
    if (!customer) {
      return NextResponse.json({ success: false, error: 'Customer not found' }, { status: 404 });
    }
    if (!customer.isLoginDisabled) {
      return NextResponse.json({ success: false, error: 'Customer login is already enabled' }, { status: 400 });
    }

    await db.customer.update({
      where: { id: customerId },
      data: {
        isLoginDisabled: false,
        failedLoginAttempts: 0,
        accountLockedUntil: null,
      },
    });

    console.log(`[admin/enable-login] actorId=${actor.id} customerId=${customerId} businessId=${businessId}`);

    await db.activityLog.create({
      data: {
        userId: actor.id,
        action: 'admin.customer_login_enabled',
        entity: 'Customer',
        entityId: customerId,
        details: JSON.stringify({ businessId, customerEmail: customer.email }),
      },
    }).catch(() => null);

    return NextResponse.json({ success: true, message: 'Customer login enabled successfully' });
  } catch (error) {
    console.error('[admin/customers/enable-login]', error);
    return NextResponse.json({ success: false, error: 'Failed to enable login' }, { status: 500 });
  }
});
