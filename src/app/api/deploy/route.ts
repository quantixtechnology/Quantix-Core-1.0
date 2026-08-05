// ============================================================================
// QUANTIX CORE — Deploy Webhook Trigger
// POST /api/deploy
//
// GitHub Actions POSTs here to trigger deployment on the VPS.
// The endpoint spawns deploy-local.sh as a DETACHED process.
//
// Security measures:
//   - Constant-time secret comparison (timingSafeEqual)
//   - Atomic lock-file creation (prevents concurrent deploys)
//   - Rate limit: 10 attempts per hour per IP
//   - Timestamp replay window: rejects requests >5 minutes old
//
// Error Handling:
//   - All failures return structured JSON (never blank 500)
//   - Each operation has detailed error with stage/message/stack
//   - GET /api/deploy/debug provides system diagnostics for remote troubleshooting
// ============================================================================

import { NextResponse } from 'next/server'
import { spawn } from 'child_process'
import { existsSync, openSync, writeFileSync, closeSync } from 'fs'
import { timingSafeEqual, createHash } from 'crypto'
import path from 'path'
import { readFileSync } from 'fs'

export const runtime = 'nodejs'

// ── Module-level diagnostics ────────────────────────────────────────────────
const MODULE_LOADED_AT = new Date().toISOString()
const MODULE_VERSION = 'v1'

interface ExecutionState {
  handlerEntered: boolean
  handlerEnteredAt?: string
  lastStage?: string
  lastError?: string
  lastRequestTime?: string
}

const executionState: ExecutionState = {
  handlerEntered: false,
}

// ────────────────────────────────────────────────────────────────────────────

const LOCK_FILE = '/tmp/quantix-deploy.lock'
const STATUS_FILE = '/tmp/quantix-deploy-status.json'

function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}

const RATE_WINDOW_MS = 60 * 60 * 1000
const RATE_MAX = 10

interface RateBucket { count: number; resetAt: number }
const rateBuckets = new Map<string, RateBucket>()

function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now()
  const bucket = rateBuckets.get(ip)

  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return { allowed: true }
  }

  if (bucket.count >= RATE_MAX) {
    return { allowed: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) }
  }

  bucket.count++
  return { allowed: true }
}

function getIp(req: Request): string {
  return (
    req.headers.get('x-real-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    'unknown'
  )
}

function resolveScriptPath(): { scriptPath: string; resolvedVia: string } {
  const SCRIPT_FILENAME = 'scripts/deploy-local.sh'
  const projectDir = process.env.QUANTIX_PROJECT_DIR
  if (projectDir) {
    const p = path.join(projectDir, SCRIPT_FILENAME)
    if (existsSync(p)) return { scriptPath: p, resolvedVia: 'QUANTIX_PROJECT_DIR' }
    return { scriptPath: p, resolvedVia: 'QUANTIX_PROJECT_DIR (not found)' }
  }

  let dir = process.cwd()
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(dir, SCRIPT_FILENAME)
    if (existsSync(candidate) && !candidate.includes('.next')) {
      return { scriptPath: candidate, resolvedVia: `walk-up[${i}]` }
    }
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }

  const legacyCandidates = [
    path.join(process.cwd(), SCRIPT_FILENAME),
    path.join(process.cwd(), '..', '..', SCRIPT_FILENAME),
    path.join(process.cwd(), '..', SCRIPT_FILENAME),
  ]
  for (const p of legacyCandidates) {
    try {
      if (existsSync(p)) return { scriptPath: p, resolvedVia: `legacy:${p}` }
    } catch {
      /* ignore */
    }
  }
  return { scriptPath: legacyCandidates[0], resolvedVia: 'legacy:not-found' }
}

function resolveSecret(): { source: string; secret?: string } {
  if (process.env.DEPLOY_WEBHOOK_SECRET) return { source: 'env', secret: process.env.DEPLOY_WEBHOOK_SECRET }
  if (process.env.DEPLOY_WEBHOOK_SECRET_FILE) {
    try {
      const s = readFileSync(process.env.DEPLOY_WEBHOOK_SECRET_FILE, 'utf-8').trim()
      if (s) return { source: `file:${process.env.DEPLOY_WEBHOOK_SECRET_FILE}`, secret: s }
    } catch {
      /* ignore */
    }
  }
  const candidates = [
    path.join(process.env.QUANTIX_PROJECT_DIR || '/home/ubuntu/Quantix-Core-1.0', '.deploy_webhook_secret'),
    '/etc/quantix/deploy_webhook_secret',
    '/home/ubuntu/.deploy_webhook_secret',
  ]
  for (const c of candidates) {
    try {
      if (existsSync(c)) {
        const s = readFileSync(c, 'utf-8').trim()
        if (s) return { source: `file:${c}`, secret: s }
      }
    } catch {
      /* ignore */
    }
  }
  return { source: 'none' }
}

export async function POST(req: Request) {
  const handlerEnteredAt = new Date().toISOString()
  executionState.handlerEntered = true
  executionState.handlerEnteredAt = handlerEnteredAt
  executionState.lastRequestTime = handlerEnteredAt

  const ip = getIp(req)
  const requestAt = handlerEnteredAt

  try {
    // ── 1. Rate limit ──────────────────────────────────────────────────────────
    try {
      const rate = checkRateLimit(ip)
      if (!rate.allowed) {
        return NextResponse.json(
          {
            success: false,
            stage: 'rate_limit',
            message: 'Too many requests',
            retryAfter: rate.retryAfter,
          },
          { status: 429, headers: { 'Retry-After': String(rate.retryAfter ?? 3600) } }
        )
      }
    } catch (err) {
      throw { stage: 'rate_limit', error: err }
    }

    // ── 2. Secret validation ───────────────────────────────────────────────────
    let secret: string
    try {
      const resolved = resolveSecret()
      if (!resolved.secret) {
        return NextResponse.json(
          {
            success: false,
            stage: 'secret_resolution',
            message: 'DEPLOY_WEBHOOK_SECRET not configured',
            source: resolved.source,
          },
          { status: 500 }
        )
      }
      secret = resolved.secret
    } catch (err) {
      throw { stage: 'secret_resolution', error: err }
    }

    // ── 3. Authenticate request ────────────────────────────────────────────────
    try {
      const provided = req.headers.get('x-deploy-secret') ?? ''
      if (!provided || !safeEqual(provided, secret)) {
        return NextResponse.json(
          {
            success: false,
            stage: 'authentication',
            message: 'Unauthorized',
          },
          { status: 401 }
        )
      }
    } catch (err) {
      throw { stage: 'authentication', error: err }
    }

    // ── 4. Timestamp validation ────────────────────────────────────────────────
    try {
      const tsHeader = req.headers.get('x-deploy-timestamp')
      if (tsHeader) {
        const ts = parseInt(tsHeader, 10)
        const ageSec = Math.floor(Date.now() / 1000) - ts
        if (isNaN(ts) || ageSec > 300 || ageSec < -30) {
          return NextResponse.json(
            {
              success: false,
              stage: 'timestamp_validation',
              message: 'Request timestamp out of acceptable window',
              ageSec,
            },
            { status: 400 }
          )
        }
      }
    } catch (err) {
      throw { stage: 'timestamp_validation', error: err }
    }

    // ── 5. Lock acquisition ────────────────────────────────────────────────────
    try {
      const fd = openSync(LOCK_FILE, 'wx')
      closeSync(fd)
    } catch (lockErr) {
      let current: Record<string, unknown> = {}
      try {
        current = JSON.parse(readFileSync(STATUS_FILE, 'utf-8'))
      } catch {
        /* ignore */
      }
      return NextResponse.json(
        {
          success: false,
          stage: 'lock_acquisition',
          message: 'Deploy already in progress',
          currentStatus: current,
        },
        { status: 409 }
      )
    }

    // ── 6. Script verification ────────────────────────────────────────────────
    let scriptPath: string
    try {
      const resolved = resolveScriptPath()
      scriptPath = resolved.scriptPath
      if (!existsSync(scriptPath)) {
        try {
          const fs = await import('fs')
          fs.unlinkSync(LOCK_FILE)
        } catch {
          /* ignore */
        }
        return NextResponse.json(
          {
            success: false,
            stage: 'script_verification',
            message: 'Deployment script not found',
            path: scriptPath,
          },
          { status: 500 }
        )
      }
    } catch (err) {
      throw { stage: 'script_verification', error: err }
    }

    // ── 7. Write initial status ────────────────────────────────────────────────
    try {
      writeFileSync(
        STATUS_FILE,
        JSON.stringify({
          status: 'queued',
          step: 'queued',
          message: 'Deploy accepted, starting…',
          triggeredAt: requestAt,
          triggeredBy: ip,
        })
      )
    } catch (err) {
      throw { stage: 'status_write', error: err }
    }

    // ── 8. Spawn process ───────────────────────────────────────────────────────
    try {
      const { __NEXT_PRIVATE_STANDALONE_CONFIG: _stripped, ...spawnEnv } = process.env

      // Optional: NEXT_PUBLIC_GOOGLE_MAPS_API_KEY forwarded from the GitHub
      // Actions secret via the x-maps-key header, so the VPS build can bake the
      // Google Maps key into the release WITHOUT it ever being committed to git.
      const mapsKey = req.headers.get('x-maps-key')?.trim() ?? ''
      const buildEnv = mapsKey ? { ...spawnEnv, QUANTIX_MAPS_KEY: mapsKey } : spawnEnv

      const intermediate = spawn('/bin/bash', ['-c', '/bin/bash "$DEPLOY_SCRIPT" </dev/null >/dev/null 2>&1 & disown'], {
        detached: true,
        stdio: 'ignore',
        env: { ...buildEnv, DEPLOY_SCRIPT: scriptPath },
      })

      intermediate.on('error', (err) => {
        console.error('[Deploy] Process spawn error:', err.message)
        try {
          const { unlinkSync } = require('fs')
          unlinkSync(LOCK_FILE)
        } catch {
          /* ignore */
        }
      })

      intermediate.unref()
    } catch (err) {
      throw { stage: 'process_spawn', error: err }
    }

    // ── 9. Success ─────────────────────────────────────────────────────────────
    return NextResponse.json({
      success: true,
      message: 'Deploy triggered. Poll /api/deploy/status for progress.',
    })
  } catch (err: any) {
    // Clean up lock file on error
    try {
      const { unlinkSync } = await import('fs')
      unlinkSync(LOCK_FILE)
    } catch {
      /* ignore */
    }

    const error = err instanceof Error ? err : new Error(String(err))
    const stage = err?.stage || 'unknown'

    executionState.lastStage = stage
    executionState.lastError = error.message

    console.error(`[Deploy] Error at stage: ${stage}`, error)

    return NextResponse.json(
      {
        success: false,
        stage,
        message: error.message || 'Unknown error',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        timestamp: requestAt,
      },
      { status: 500 }
    )
  }
}

// ── Diagnostic exports ──────────────────────────────────────────────────────
export { executionState, MODULE_LOADED_AT, MODULE_VERSION }
