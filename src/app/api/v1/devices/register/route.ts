// ============================================================================
// QUANTIX API v1 — Device Registration
// POST /api/v1/devices/register
//
// Called by Flutter on app launch (after login).
// Stores FCM token in NotificationDevice (multi-device support).
// Also updates legacy User.fcmToken for backward compat.
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { db } from '@/lib/db';

export const POST = withMiddleware({ requireAuth: true })(async (req) => {
  try {
    const user = req.user!;
    const body = await req.json() as {
      fcmToken: string;
      platform: 'ANDROID' | 'IOS' | 'WEB';
      deviceId?: string;
      appVersion?: string;
    };

    const { fcmToken, platform, deviceId, appVersion } = body;
    if (!fcmToken) return NextResponse.json({ success: false, error: 'fcmToken is required' }, { status: 400 });
    if (!platform) return NextResponse.json({ success: false, error: 'platform is required' }, { status: 400 });
    if (!['ANDROID', 'IOS', 'WEB'].includes(platform)) {
      return NextResponse.json({ success: false, error: 'platform must be ANDROID, IOS, or WEB' }, { status: 400 });
    }

    const businessId = user.businessId ?? '';

    // Upsert by userId + deviceId (or userId + fcmToken if no deviceId)
    let device;
    if (deviceId) {
      device = await db.notificationDevice.upsert({
        where: { userId_deviceId: { userId: user.id, deviceId } },
        create: { userId: user.id, businessId, fcmToken, platform, deviceId, appVersion, isActive: true, lastActive: new Date() },
        update: { fcmToken, platform, appVersion, isActive: true, lastActive: new Date() },
      });
    } else {
      // No deviceId — find existing by token or create new
      device = await db.notificationDevice.upsert({
        where: { userId_deviceId: { userId: user.id, deviceId: fcmToken } },
        create: { userId: user.id, businessId, fcmToken, platform, deviceId: fcmToken, appVersion, isActive: true, lastActive: new Date() },
        update: { platform, appVersion, isActive: true, lastActive: new Date() },
      });
    }

    // Keep legacy User.fcmToken in sync (latest device wins)
    await db.user.update({ where: { id: user.id }, data: { fcmToken } }).catch(() => {});

    return NextResponse.json({
      success: true,
      data: { deviceId: device.id, platform, registered: true },
      message: 'Device registered successfully',
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to register device';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
});
