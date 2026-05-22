// GET /api/debug/runtime-version
// Returns current build ID + runtime info. Used by CacheBuster to detect stale client bundles.
// Cache-Control: no-store — must always return fresh data.

import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'

export const dynamic = 'force-dynamic'

function readBuildId(): string {
  // Standard Next.js build output
  const candidates = [
    join(process.cwd(), '.next', 'BUILD_ID'),
    join(process.cwd(), 'BUILD_ID'),
    // Standalone: server.js runs from .next/standalone, cwd may differ
    join(__dirname, '..', '..', '..', '..', '.next', 'BUILD_ID'),
  ]
  for (const p of candidates) {
    try { return readFileSync(p, 'utf8').trim() } catch { /* try next */ }
  }
  return 'dev'
}

export async function GET() {
  const buildId = readBuildId()

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
