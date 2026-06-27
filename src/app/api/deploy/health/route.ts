// ============================================================================
// GET /api/deploy/health — Lightweight health check
// Returns immediately without initialization of business modules
// ============================================================================

import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET() {
  const startTime = Date.now()

  return NextResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.NEXT_PUBLIC_APP_VERSION || 'unknown',
    uptime: Math.floor(process.uptime()),
    responseTimeMs: Date.now() - startTime,
  })
}
