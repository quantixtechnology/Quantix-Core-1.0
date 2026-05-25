// ============================================================================
// QUANTIX CORE — Mobile Provision Status
// GET /api/core/businesses/[businessId]/mobile/status
//   Returns current mobile build status from Core DB + live sync from
//   the provision service.
//   Accessible to platform admins and the business owner.
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { db } from '@/lib/db';
import { getMobileProvisionStatus } from '@/lib/mobile-provision';

export const GET = withMiddleware({ requireAuth: true })(async (req, context) => {
  try {
    const params = await context?.params;
    const businessId = params?.businessId as string;
    if (!businessId) {
      return NextResponse.json({ success: false, error: 'businessId is required' }, { status: 400 });
    }

    const user = req.user!;
    if (!user.isPlatformAdmin && user.businessId !== businessId) {
      return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 });
    }

    const business = await db.business.findUnique({
      where: { id: businessId },
      select: { slug: true },
    });
    if (!business) {
      return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 });
    }

    // Fetch DB state
    const deployments = await db.deployment.findMany({
      where: {
        businessId,
        type: { in: ['CUSTOMER_APP', 'DELIVERY_APP', 'ADMIN_APP'] },
      },
      select: {
        id: true,
        type: true,
        status: true,
        buildUrl: true,
        liveUrl: true,
        hostingConfig: true,
        deployedAt: true,
        lastCheckedAt: true,
        notes: true,
      },
    });

    // Live-sync from provision service (non-blocking — returns null if unreachable)
    const live = await getMobileProvisionStatus(businessId, business.slug);

    // Build unified response
    const appsMap = Object.fromEntries(
      deployments.map((d) => {
        const cfg = d.hostingConfig
          ? (JSON.parse(d.hostingConfig) as Record<string, unknown>)
          : {};
        return [
          d.type,
          {
            type: d.type,
            status: d.status,
            repoUrl: (cfg.repoUrl as string | null) ?? d.buildUrl,
            apkUrl: (cfg.apkUrl as string | null) ?? d.liveUrl,
            aabUrl: cfg.aabUrl as string | null,
            brandingStatus: cfg.brandingStatus as string | null,
            firebaseStatus: cfg.firebaseStatus as string | null,
            error: cfg.error as string | null,
            deployedAt: d.deployedAt,
            lastCheckedAt: d.lastCheckedAt,
          },
        ];
      }),
    );

    return NextResponse.json({
      success: true,
      slug: business.slug,
      serviceReachable: live !== null,
      liveStatus: live?.status ?? null,
      apps: appsMap,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get mobile status';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
