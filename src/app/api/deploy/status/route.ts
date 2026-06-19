// ============================================================================
// QUANTIX CORE — Deploy Status Endpoint
// GET /api/deploy/status
//
// Polled by GitHub Actions after triggering /api/deploy.
// Reads the JSON status file written by deploy-local.sh.
//
// Security:
//   - Constant-time secret comparison (same as trigger endpoint)
//   - Header-only auth (x-deploy-secret) — query-param support removed
//     because query params appear in Nginx/CDN access logs, leaking the secret
//   - Response never includes raw env vars; log tail is auth-gated
//   - durationSeconds derived server-side (client cannot spoof startedAt)
// ============================================================================

import { NextResponse }  from 'next/server'
import { existsSync, readFileSync } from 'fs'
import { timingSafeEqual, createHash } from 'crypto'

export const runtime = 'nodejs'

const STATUS_FILE = '/tmp/quantix-deploy-status.json'
const LOG_FILE    = '/tmp/quantix-deploy.log'
const LOCK_FILE   = '/tmp/quantix-deploy.lock'

// Shared with trigger route — both must use the same algorithm
function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}

function deriveDuration(data: Record<string, unknown>): number | null {
  const start = data.startedAt as string | undefined
  const end   = data.updatedAt as string | undefined
  if (!start || !end) return null
  const ms = new Date(end).getTime() - new Date(start).getTime()
  if (isNaN(ms) || ms < 0) return null
  return Math.round(ms / 1000)
}

export async function GET(req: Request) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  // Resolve secret similarly to trigger route so status polling is consistent.
  const resolveSecret = (): string | null => {
    if (process.env.DEPLOY_WEBHOOK_SECRET) return process.env.DEPLOY_WEBHOOK_SECRET
    try {
      const candidates = [
        `${process.env.QUANTIX_PROJECT_DIR || '/root/Quantix-Core-1.0'}/.deploy_webhook_secret`,
        '/etc/quantix/deploy_webhook_secret',
        '/root/.deploy_webhook_secret',
      ]
      for (const c of candidates) {
        try { if (existsSync(c)) return readFileSync(c, 'utf-8').trim() } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
    return null
  }

  const secret = resolveSecret()
  if (!secret) {
    console.error('[DeployStatus] DEPLOY_WEBHOOK_SECRET not configured; tried env and common secret files')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  // Header only — intentionally no ?secret= query-param support.
  // URL query params are recorded verbatim in Nginx/CDN access logs; putting
  // a secret in a query param leaks it to any logging infrastructure.
  const provided = req.headers.get('x-deploy-secret') ?? ''
  if (!provided || !safeEqual(provided, secret)) {
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
      status:  'unknown',
      error:   'Status file unreadable',
      locked:  existsSync(LOCK_FILE),
    })
  }

  // ── Duration ─────────────────────────────────────────────────────────────────
  const durationSeconds = deriveDuration(statusData)

  // ── Log tail (auth-gated — only returned to authenticated caller) ────────────
  // Returns the last 40 lines so CI output has context without flooding logs.
  // Sensitive env vars are never written to the log by deploy-local.sh.
  let tail: string[] = []
  try {
    if (existsSync(LOG_FILE)) {
      const lines = readFileSync(LOG_FILE, 'utf-8').split('\n')
      tail = lines.slice(-40).filter(Boolean)
    }
  } catch { /* non-critical */ }

  return NextResponse.json({
    ...statusData,
    locked:          existsSync(LOCK_FILE),
    durationSeconds,
    tail,
  })
}
