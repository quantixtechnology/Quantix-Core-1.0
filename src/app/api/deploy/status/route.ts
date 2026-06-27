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
  try {
    // ── Auth ────────────────────────────────────────────────────────────────────
    let secret: string | null = null
    try {
      // Try environment variable first
      if (process.env.DEPLOY_WEBHOOK_SECRET) {
        secret = process.env.DEPLOY_WEBHOOK_SECRET
      } else {
        // Try file-based secrets
        const candidates = [
          `${process.env.QUANTIX_PROJECT_DIR || '/root/Quantix-Core-1.0'}/.deploy_webhook_secret`,
          '/etc/quantix/deploy_webhook_secret',
          '/root/.deploy_webhook_secret',
        ]
        for (const c of candidates) {
          try {
            if (existsSync(c)) {
              secret = readFileSync(c, 'utf-8').trim()
              if (secret) break
            }
          } catch {
            /* ignore file read errors */
          }
        }
      }
    } catch (err) {
      return NextResponse.json(
        { error: 'Secret resolution error', details: err instanceof Error ? err.message : String(err) },
        { status: 500 }
      )
    }

    if (!secret) {
      return NextResponse.json(
        {
          error: 'Server misconfiguration',
          details: 'DEPLOY_WEBHOOK_SECRET not configured in environment or file',
        },
        { status: 500 }
      )
    }

    // ── Authentication ──────────────────────────────────────────────────────────
    const provided = req.headers.get('x-deploy-secret') ?? ''
    if (!provided) {
      return NextResponse.json({ error: 'Missing x-deploy-secret header' }, { status: 401 })
    }

    try {
      if (!safeEqual(provided, secret)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    } catch (err) {
      return NextResponse.json(
        { error: 'Authentication error', details: err instanceof Error ? err.message : String(err) },
        { status: 500 }
      )
    }

    // ── Read status ─────────────────────────────────────────────────────────────
    if (!existsSync(STATUS_FILE)) {
      return NextResponse.json({ status: 'idle', locked: existsSync(LOCK_FILE) })
    }

    let statusData: Record<string, unknown> = {}
    try {
      statusData = JSON.parse(readFileSync(STATUS_FILE, 'utf-8'))
    } catch (err) {
      return NextResponse.json(
        {
          status: 'unknown',
          error: 'Status file unreadable',
          details: err instanceof Error ? err.message : String(err),
          locked: existsSync(LOCK_FILE),
        },
        { status: 500 }
      )
    }

    // ── Duration ─────────────────────────────────────────────────────────────────
    let durationSeconds: number | null = null
    try {
      durationSeconds = deriveDuration(statusData)
    } catch {
      /* non-critical */
    }

    // ── Log tail ─────────────────────────────────────────────────────────────────
    let tail: string[] = []
    try {
      if (existsSync(LOG_FILE)) {
        const lines = readFileSync(LOG_FILE, 'utf-8').split('\n')
        tail = lines.slice(-40).filter(Boolean)
      }
    } catch {
      /* non-critical */
    }

    return NextResponse.json({
      ...statusData,
      locked: existsSync(LOCK_FILE),
      durationSeconds,
      tail,
    })
  } catch (err) {
    // Catch-all for any unexpected errors
    const error = err instanceof Error ? err : new Error(String(err))
    console.error('[DeployStatus] Unexpected error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message,
        stage: 'handler_execution',
      },
      { status: 500 }
    )
  }
}
