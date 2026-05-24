// ============================================================================
// QUANTIX API v1 — Device Unregister (logout / token rotation)
// DELETE /api/v1/devices/unregister
// Body: { fcmToken: string } OR { deviceId: string }
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { db } from '@/lib/db';

export const DELETE = withMiddleware({ requireAuth: true })(async (req) => {
  try {
    const user = req.user!;
    const body = await req.json().catch(() => ({})) as { fcmToken?: string; deviceId?: string };
    const { fcmToken, deviceId } = body;

    if (!fcmToken && !deviceId) {
      return NextResponse.json({ success: false, error: 'fcmToken or deviceId is required' }, { status: 400 });
    }

    const where = deviceId
      ? { userId_deviceId: { userId: user.id, deviceId } }
      : { userId_deviceId: { userId: user.id, deviceId: fcmToken! } };

    await db.notificationDevice.updateMany({
      where: { userId: user.id, ...(fcmToken ? { fcmToken } : { deviceId }) },
      data: { isActive: false },
    }).catch(() => {});

    // Clear legacy User.fcmToken if it matches
    if (fcmToken) {
      const u = await db.user.findUnique({ where: { id: user.id }, select: { fcmToken: true } });
      if (u?.fcmToken === fcmToken) {
        await db.user.update({ where: { id: user.id }, data: { fcmToken: null } }).catch(() => {});
      }
    }

    void where; // suppress unused warning

    return NextResponse.json({ success: true, message: 'Device unregistered' });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to unregister device';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
});
