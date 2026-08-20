// GET /api/debug/runtime-version
// Returns current build ID + runtime info. Used by CacheBuster to detect stale client bundles.
// Cache-Control: no-store — must always return fresh data.

import { NextResponse } from 'next/server'
import { platformOnly } from "@/lib/platform-guard"
import { getBuildId } from '@/lib/build-id'

export const dynamic = 'force-dynamic'


export async function GET(request: Request) {
  // Platform staff only — diagnostics/administration, never tenant-reachable.
  const _denied = await platformOnly(request)
  if (_denied) return _denied
  const buildId = getBuildId()

  return NextResponse.json(
    {
      success: true,
      data: {
        buildId,
        version: '2.1.0',
        cacheVersion: `quantix-${buildId}`,
        swVersion:    `quantix-sw-${buildId}`,
        nodeVersion:  process.version,
        timestamp:    new Date().toISOString(),
        uptimeSeconds: Math.floor(process.uptime()),
      },
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        Pragma: 'no-cache',
      },
    }
  )
}
