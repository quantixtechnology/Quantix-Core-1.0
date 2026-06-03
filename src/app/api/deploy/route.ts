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
// Required env vars:
//   DEPLOY_WEBHOOK_SECRET  — strong random string ≥ 32 chars
//                            generate: openssl rand -hex 32
//   QUANTIX_PROJECT_DIR    — absolute path to the project root on the VPS
//                            e.g. /root/Quantix-Core-1.0
//                            Set in ecosystem.config.js env section.
//
// WHY QUANTIX_PROJECT_DIR IS REQUIRED:
//   Next.js standalone server.js calls process.chdir(__dirname) at startup,
//   shifting process.cwd() to .next/standalone/.  The standalone output
//   contains a full copy of the project tree, including scripts/, so a
//   cwd-relative path resolution always resolves to the STALE copy frozen
//   at build time rather than the live git working-tree script.
//   QUANTIX_PROJECT_DIR bypasses this entirely by using an explicit absolute
//   path that is never inside the standalone directory.
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
function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}

// ─── Rate limiter ─────────────────────────────────────────────────────────────
const RATE_WINDOW_MS = 60 * 60 * 1000
const RATE_MAX       = 10

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
// IMPORTANT: process.cwd() is unreliable here.  Next.js standalone server.js
// calls process.chdir(__dirname) at startup, so process.cwd() is the
// .next/standalone/ directory — NOT the project root.  The standalone
// directory contains a full project-tree copy (including scripts/) which
// is a stale snapshot from build time.  Always use QUANTIX_PROJECT_DIR first.
function resolveScriptPath(): { scriptPath: string; resolvedVia: string } {
  const SCRIPT_FILENAME = 'scripts/deploy-local.sh'

  // ── Primary: explicit project root env var (set in ecosystem.config.js) ───
  const projectDir = process.env.QUANTIX_PROJECT_DIR
  if (projectDir) {
    const p = path.join(projectDir, SCRIPT_FILENAME)
    if (existsSync(p)) return { scriptPath: p, resolvedVia: 'QUANTIX_PROJECT_DIR' }
    // Env var is set but script missing — return it anyway so caller can give
    // a meaningful "not found" error pointing at the configured directory.
    return { scriptPath: p, resolvedVia: 'QUANTIX_PROJECT_DIR (not found)' }
  }

  // ── Fallback: walk up from cwd looking for the git root ───────────────────
  // Avoids picking up the stale standalone copy by verifying the candidate
  // lives OUTSIDE .next/standalone/.
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

  // ── Last resort: old fixed candidates (may hit standalone — log shows this) ─
  const legacyCandidates = [
    path.join(process.cwd(), SCRIPT_FILENAME),
    path.join(process.cwd(), '..', '..', SCRIPT_FILENAME),
    path.join(process.cwd(), '..', SCRIPT_FILENAME),
  ]
  for (const p of legacyCandidates) {
    try { if (existsSync(p)) return { scriptPath: p, resolvedVia: `legacy:${p}` } }
    catch { /* ignore */ }
  }
  return { scriptPath: legacyCandidates[0], resolvedVia: 'legacy:not-found' }
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  const ip        = getIp(req)
  const requestAt = new Date().toISOString()

  const log = (result: string, extra?: Record<string, unknown>) => {
    console.log(JSON.stringify({ service: 'deploy', requestAt, ip, result, ...extra }))
  }

  // Diagnostic: log environment context on every request so the deploy log
  // captures exactly which script is resolved and what environment the
  // webhook handler sees.  This distinguishes manual SSH builds (which run
  // the live git-tree script) from webhook builds (which historically ran the
  // stale standalone copy).
  const { scriptPath, resolvedVia } = resolveScriptPath()
  log('webhook_env_diagnostic', {
    cwd:                process.cwd(),
    HOSTNAME:           process.env.HOSTNAME   ?? '(not set)',
    PORT:               process.env.PORT        ?? '(not set)',
    QUANTIX_PROJECT_DIR:process.env.QUANTIX_PROJECT_DIR ?? '(not set)',
    resolvedScriptPath: scriptPath,
    resolvedVia,
    standaloneConfigSet: !!process.env.__NEXT_PRIVATE_STANDALONE_CONFIG,
    command:            `bash ${scriptPath}`,
  })

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
      { status: 429, headers: { 'Retry-After': String(rate.retryAfter ?? 3600) } }
    )
  }

  // ── 3. Constant-time secret validation ───────────────────────────────────
  const provided = req.headers.get('x-deploy-secret') ?? ''
  if (!provided || !safeEqual(provided, secret)) {
    log('unauthorized')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── 4. Timestamp replay window ────────────────────────────────────────────
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
  try {
    const fd = openSync(LOCK_FILE, 'wx')
    closeSync(fd)
  } catch {
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
  } catch { /* non-critical */ }

  // ── 7. Verify script exists ──────────────────────────────────────────────
  if (!existsSync(scriptPath)) {
    try { const { unlinkSync } = await import('fs'); unlinkSync(LOCK_FILE) } catch { /* ignore */ }
    log('script_not_found', { scriptPath, resolvedVia })
    return NextResponse.json({ error: 'Deploy script not found on server' }, { status: 500 })
  }

  // ── 8. Build spawn environment ───────────────────────────────────────────
  // Strip __NEXT_PRIVATE_STANDALONE_CONFIG from the child's env.
  //
  // WHY: standalone/server.js sets this variable to a JSON snapshot of the
  // build-time config.  JSON serialization drops functions, so the JSON has
  // generateBuildId: undefined.  If the variable leaks into next build, the
  // config loader takes the standalone fast-path and returns a config where
  // config.generateBuildId is undefined.  The build then calls
  // generateBuildId(undefined, nanoid) and throws
  // "TypeError: generate is not a function" before any route compiles.
  //
  // deploy-local.sh already uses `env -i` to create a clean environment for
  // `npm run build`, which strips this variable from the build subprocess.
  // This filter is a belt-and-braces defence for the bash script process
  // itself (git, npm install, prisma steps) which run outside env -i.
  const {
    __NEXT_PRIVATE_STANDALONE_CONFIG: _stripped,
    __NEXT_PRIVATE_RENDER_WORKER:     _stripped2,
    ...spawnEnv
  } = process.env

  // ── 9. Spawn detached ────────────────────────────────────────────────────
  // detached:true + unref() = child becomes its own process group and
  // survives the PM2 restart that occurs during the build step.
  const child = spawn('bash', [scriptPath], {
    detached: true,
    stdio:    'ignore',
    env:      spawnEnv,
  })

  child.on('error', (err) => {
    console.error('[Deploy] Spawn error:', err.message)
    try { const { unlinkSync } = require('fs'); unlinkSync(LOCK_FILE) } catch { /* ignore */ }
  })

  child.unref()

  log('triggered', { pid: child.pid, scriptPath, resolvedVia })

  return NextResponse.json({
    ok:      true,
    message: 'Deploy triggered. Poll /api/deploy/status for progress.',
  })
}
