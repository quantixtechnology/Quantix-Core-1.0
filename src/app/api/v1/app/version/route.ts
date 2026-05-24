// ============================================================================
// QUANTIX API v1 — App Version Gate
// GET /api/v1/app/version?platform=android|ios|web
//
// Flutter calls this on launch to check for force-update requirement.
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const platform = (searchParams.get('platform') ?? 'android').toLowerCase();

    const version = await db.appVersion.findFirst({
      where: { platform, isActive: true },
      orderBy: { publishedAt: 'desc' },
      select: {
        version: true, minVersion: true, forceUpdate: true,
        changelogUrl: true, releaseNotes: true, publishedAt: true,
      },
    });

    if (!version) {
      // Return permissive defaults when no record exists
      return NextResponse.json({
        success: true,
        data: {
          platform,
          version: '1.0.0',
          minVersion: '1.0.0',
          forceUpdate: false,
          changelogUrl: null,
          releaseNotes: null,
        },
      });
    }

    return NextResponse.json({ success: true, data: { platform, ...version } });
  } catch (e) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : 'Failed' }, { status: 500 });
  }
}
