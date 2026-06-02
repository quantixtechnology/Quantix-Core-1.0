// ============================================================================
// QUANTIX CORE — Deploy Status Endpoint
// GET /api/deploy/status
//
// Polled by GitHub Actions after triggering /api/deploy.
// Reads the JSON status file written by deploy-local.sh.
//
// Auth: same DEPLOY_WEBHOOK_SECRET via x-deploy-secret header
//       or ?secret= query param (for curl convenience in CI scripts)
// ============================================================================

import { NextResponse } from 'next/server'
import { existsSync, readFileSync } from 'fs'

const STATUS_FILE = '/tmp/quantix-deploy-status.json'
const LOG_FILE    = '/tmp/quantix-deploy.log'
const LOCK_FILE   = '/tmp/quantix-deploy.lock'

export async function GET(req: Request) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const secret = process.env.DEPLOY_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  const url = new URL(req.url)
  const provided =
    req.headers.get('x-deploy-secret') ?? url.searchParams.get('secret')

  if (!provided || provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Read status ─────────────────────────────────────────────────────────────
  if (!existsSync(STATUS_FILE)) {
    return NextResponse.json({ status: 'idle', locked: existsSync(LOCK_FILE) })
  }

  let statusData: Record<string, unknown> = {}
  try {
    statusData = JSON.parse(readFileSync(STATUS_FILE, 'utf-8'))
  } catch {
    return NextResponse.json({
      status: 'unknown',
      error: 'Status file unreadable',
      locked: existsSync(LOCK_FILE),
    })
  }

  // ── Tail log ─────────────────────────────────────────────────────────────────
  // Return the last 40 lines so CI output shows context without flooding logs
  let tail: string[] = []
  try {
    if (existsSync(LOG_FILE)) {
      const lines = readFileSync(LOG_FILE, 'utf-8').split('\n')
      tail = lines.slice(-40).filter(Boolean)
    }
  } catch { /* non-critical */ }

  return NextResponse.json({
    ...statusData,
    locked: existsSync(LOCK_FILE),
    tail,
  })
}

export const runtime = 'nodejs'
