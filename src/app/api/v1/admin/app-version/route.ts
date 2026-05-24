// ============================================================================
// QUANTIX API v1 — Admin: App Version Management
// GET    /api/v1/admin/app-version?platform=
// POST   /api/v1/admin/app-version
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { db } from '@/lib/db';

export const GET = withMiddleware({
  requireAuth: true,
  requiredRoles: ['QUANTIX_SUPER_ADMIN'],
})(async (req) => {
  try {
    const { searchParams } = new URL(req.url);
    const platform = searchParams.get('platform') ?? undefined;

    const versions = await db.appVersion.findMany({
      where: platform ? { platform } : undefined,
      orderBy: [{ platform: 'asc' }, { publishedAt: 'desc' }],
    });

    return NextResponse.json({ success: true, data: versions });
  } catch (e) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : 'Failed' }, { status: 500 });
  }
});

export const POST = withMiddleware({
  requireAuth: true,
  requiredRoles: ['QUANTIX_SUPER_ADMIN'],
})(async (req) => {
  try {
    const body = await req.json() as {
      platform: string; version: string; minVersion: string;
      forceUpdate?: boolean; changelogUrl?: string; releaseNotes?: string; isActive?: boolean;
    };

    if (!body.platform) return NextResponse.json({ success: false, error: 'platform is required' }, { status: 400 });
    if (!body.version)  return NextResponse.json({ success: false, error: 'version is required' }, { status: 400 });
    if (!body.minVersion) return NextResponse.json({ success: false, error: 'minVersion is required' }, { status: 400 });

    // Deactivate previous active version for this platform if setting a new active one
    if (body.isActive !== false) {
      await db.appVersion.updateMany({
        where: { platform: body.platform, isActive: true },
        data: { isActive: false },
      });
    }

    const version = await db.appVersion.upsert({
      where: { platform_version: { platform: body.platform, version: body.version } },
      update: {
        minVersion: body.minVersion,
        forceUpdate: body.forceUpdate ?? false,
        changelogUrl: body.changelogUrl ?? null,
        releaseNotes: body.releaseNotes ?? null,
        isActive: body.isActive !== false,
        publishedAt: new Date(),
      },
      create: {
        platform: body.platform,
        version: body.version,
        minVersion: body.minVersion,
        forceUpdate: body.forceUpdate ?? false,
        changelogUrl: body.changelogUrl ?? null,
        releaseNotes: body.releaseNotes ?? null,
        isActive: body.isActive !== false,
      },
    });

    return NextResponse.json({ success: true, data: version, message: 'App version published' }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : 'Failed' }, { status: 500 });
  }
});
