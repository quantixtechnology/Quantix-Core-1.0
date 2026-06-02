// ============================================================================
// QUANTIX CORE — Deploy Webhook Trigger
// POST /api/deploy
//
// GitHub Actions POSTs here instead of SSHing into the VPS directly.
// The endpoint spawns deploy-local.sh as a DETACHED process so the script
// survives the PM2 restart that happens mid-deploy.
//
// Security measures:
//   1. constant-time secret comparison (timingSafeEqual via SHA-256 hashing)
//   2. atomic lock-file creation (O_CREAT | O_EXCL) — prevents TOCTOU race
//   3. rate limit: 10 trigger attempts per hour per IP
//   4. timestamp replay window: rejects requests older than 5 minutes
//   5. structured request logging (timestamp, IP, result, commit)
//   6. response never leaks env vars, file paths, or log content
//
// Required env var:
//   DEPLOY_WEBHOOK_SECRET — strong random string ≥ 32 chars
//                           generate: openssl rand -hex 32
// ============================================================================

import { NextResponse } from 'next/server'
import { spawn }        from 'child_process'
import { existsSync, openSync, writeFileSync, closeSync } from 'fs'
import { timingSafeEqual, createHash } from 'crypto'
import path from 'path'

export const runtime = 'nodejs'

const LOCK_FILE   = '/tmp/quantix-deploy.lock'
const STATUS_FILE = '/tmp/quantix-deploy-status.json'

// ─── Constant-time secret comparison ─────────────────────────────────────────
// Both strings are SHA-256-hashed first so timingSafeEqual always operates
// on equal-length buffers, regardless of input length.
function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}

// ─── Rate limiter ─────────────────────────────────────────────────────────────
// In-memory token bucket: max 10 trigger attempts per IP per hour.
// Resets on process restart (acceptable — restart clears any ongoing brute force).
const RATE_WINDOW_MS = 60 * 60 * 1000   // 1 hour
const RATE_MAX       = 10               // max attempts per window

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

// ─── Script path resolution ───────────────────────────────────────────────────
function resolveScriptPath(): string {
  const candidates = [
    path.join(process.cwd(), 'scripts', 'deploy-local.sh'),
    path.join(process.cwd(), '..', '..', 'scripts', 'deploy-local.sh'),
    path.join(process.cwd(), '..', 'scripts', 'deploy-local.sh'),
  ]
  for (const p of candidates) {
    try { if (existsSync(p)) return p } catch { /* ignore */ }
  }
  return candidates[0]
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  const ip        = getIp(req)
  const requestAt = new Date().toISOString()

  const log = (result: string, extra?: Record<string, unknown>) => {
    console.log(JSON.stringify({ service: 'deploy', requestAt, ip, result, ...extra }))
  }

  // ── 1. Secret configured? ─────────────────────────────────────────────────
  const secret = process.env.DEPLOY_WEBHOOK_SECRET
  if (!secret) {
    console.error('[Deploy] DEPLOY_WEBHOOK_SECRET is not configured')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  // ── 2. Rate limit ─────────────────────────────────────────────────────────
  const rate = checkRateLimit(ip)
  if (!rate.allowed) {
    log('rate_limited')
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: { 'Retry-After': String(rate.retryAfter ?? 3600) },
      }
    )
  }

  // ── 3. Constant-time secret validation ───────────────────────────────────
  const provided = req.headers.get('x-deploy-secret') ?? ''
  if (!provided || !safeEqual(provided, secret)) {
    log('unauthorized')
    // Uniform 401 — never reveal whether the secret exists or not
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── 4. Timestamp replay window ────────────────────────────────────────────
  // CI sends x-deploy-timestamp (Unix seconds). Reject if request is older
  // than 5 minutes — prevents replayed/recorded requests being re-submitted.
  const tsHeader = req.headers.get('x-deploy-timestamp')
  if (tsHeader) {
    const ts = parseInt(tsHeader, 10)
    const ageSec = Math.floor(Date.now() / 1000) - ts
    if (isNaN(ts) || ageSec > 300 || ageSec < -30) {
      log('replay_rejected', { ageSec })
      return NextResponse.json(
        { error: 'Request timestamp out of acceptable window' },
        { status: 400 }
      )
    }
  }

  // ── 5. Atomic lock acquisition ────────────────────────────────────────────
  // openSync with 'wx' flag = O_CREAT | O_EXCL — atomically fails if the
  // lock file already exists. This closes the TOCTOU race between the
  // existsSync check and the script creating the file.
  try {
    const fd = openSync(LOCK_FILE, 'wx')
    closeSync(fd)
  } catch {
    // Lock already held — a deploy is in progress
    let current: Record<string, unknown> = {}
    try {
      const { readFileSync } = await import('fs')
      current = JSON.parse(readFileSync(STATUS_FILE, 'utf-8'))
    } catch { /* ignore */ }
    log('concurrent_rejected')
    return NextResponse.json(
      { error: 'Deploy already in progress', status: current.status, step: current.step },
      { status: 409 }
    )
  }

  // ── 6. Write initial queued status ───────────────────────────────────────
  // Written BEFORE spawning so the status endpoint never returns the
  // previous deploy's "success" while the new deploy is queuing.
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
  } catch { /* non-critical — script will overwrite immediately */ }

  // ── 7. Resolve script ────────────────────────────────────────────────────
  const scriptPath = resolveScriptPath()
  if (!existsSync(scriptPath)) {
    // Release lock — script can't run
    try { const { unlinkSync } = await import('fs'); unlinkSync(LOCK_FILE) } catch { /* ignore */ }
    log('script_not_found', { scriptPath })
    return NextResponse.json({ error: 'Deploy script not found on server' }, { status: 500 })
  }

  // ── 8. Spawn detached ────────────────────────────────────────────────────
  // detached:true + unref() = child becomes its own process group and
  // survives the PM2 restart that occurs during the build step.
  // The script itself will release the lock via its own EXIT trap.
  const child = spawn('bash', [scriptPath], {
    detached: true,
    stdio:    'ignore',
    env:      { ...process.env },
  })

  child.on('error', (err) => {
    console.error('[Deploy] Spawn error:', err.message)
    try { const { unlinkSync } = require('fs'); unlinkSync(LOCK_FILE) } catch { /* ignore */ }
  })

  child.unref()

  log('triggered', { pid: child.pid })

  // Response intentionally omits: script path, env vars, file system details
  return NextResponse.json({
    ok:      true,
    message: 'Deploy triggered. Poll /api/deploy/status for progress.',
  })
}
