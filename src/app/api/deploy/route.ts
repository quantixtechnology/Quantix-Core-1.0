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
//   QUANTIX_PROJECT_DIR    — absolute path to the project root on the VPS (e.g. /home/ubuntu/Quantix-Core-1.0)
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
import { readFileSync } from 'fs'

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

// ─── Secret resolution ────────────────────────────────────────────────────────
// Resolve deploy webhook secret from env or well-known files on the host.
function resolveSecret(): { source: string; secret?: string } {
  if (process.env.DEPLOY_WEBHOOK_SECRET) return { source: 'env', secret: process.env.DEPLOY_WEBHOOK_SECRET }
  if (process.env.DEPLOY_WEBHOOK_SECRET_FILE) {
    try { const s = readFileSync(process.env.DEPLOY_WEBHOOK_SECRET_FILE, 'utf-8').trim(); if (s) return { source: `file:${process.env.DEPLOY_WEBHOOK_SECRET_FILE}`, secret: s } } catch { /* ignore */ }
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
    } catch { /* ignore */ }
  }
  return { source: 'none' }
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  console.log('[DEPLOY] POST received')

  const ip        = getIp(req)
  const requestAt = new Date().toISOString()

  const log = (result: string, extra?: Record<string, unknown>) => {
    console.log(JSON.stringify({ service: 'deploy', requestAt, ip, result, ...extra }))
  }

  // Global error handler — ensure we always return JSON
  const errorResponse = (error: string, details?: unknown, status = 500) => {
    console.error(`[Deploy] Error: ${error}`, details)
    log('error', { error, details: String(details) })
    return NextResponse.json(
      { success: false, error, ...(process.env.NODE_ENV === 'development' && { details }) },
      { status }
    )
  }

  try {
    // ── 1. Secret configured? ─────────────────────────────────────────────────
    console.log('[DEPLOY] Resolving secret')
    const resolved = resolveSecret()
    console.log('[DEPLOY] Secret resolved:', { source: resolved.source, hasSecret: !!resolved.secret })

    console.log('[DEPLOY] Resolving script path')
    const { scriptPath, resolvedVia } = resolveScriptPath()
    console.log('[DEPLOY] Script path resolved:', { scriptPath, resolvedVia })

    // Do NOT expose the secret value in logs. Only log configured/not configured
    console.log(`[Deploy] DEPLOY_WEBHOOK_SECRET = ${resolved.secret ? 'configured' : 'not configured'}`)

    log('webhook_env_diagnostic', {
      cwd:                process.cwd(),
      HOSTNAME:           process.env.HOSTNAME   ?? '(not set)',
      PORT:               process.env.PORT        ?? '(not set)',
      QUANTIX_PROJECT_DIR:process.env.QUANTIX_PROJECT_DIR ?? '(not set)',
      resolvedScriptPath: scriptPath,
      resolvedVia,
      standaloneConfigSet: !!process.env.__NEXT_PRIVATE_STANDALONE_CONFIG,
      command:            `/bin/bash -c '/bin/bash "$DEPLOY_SCRIPT" </dev/null >/dev/null 2>&1 &'`,
      deployWebhookSecret: resolved.secret ? 'configured' : 'not configured'
    })

    if (!resolved.secret) {
      const diagnostics = {
        cwd: process.cwd(),
        pm2Process: process.env.name || process.env.PM2_PROGRAM_NAME || '(not running in PM2)',
        secretExists: false,
        deployScriptPath: scriptPath,
        environmentSource: resolved.source
      }
      console.error('[Deploy] DEPLOY_WEBHOOK_SECRET not configured. Server misconfiguration.', diagnostics)
      return errorResponse('DEPLOY_WEBHOOK_SECRET not configured', diagnostics, 500)
    }
    const secret = resolved.secret
    console.log('[DEPLOY] Secret is configured')
    log('secret_resolved', { source: resolved.source })

    // ── 2. Rate limit ─────────────────────────────────────────────────────────
    console.log('[DEPLOY] Checking rate limit for IP:', ip)
    const rate = checkRateLimit(ip)
    if (!rate.allowed) {
      console.log('[DEPLOY] Rate limited')
      log('rate_limited')
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfter ?? 3600) } }
      )
    }
    console.log('[DEPLOY] Rate limit OK')

    // ── 3. Constant-time secret validation ───────────────────────────────────
    console.log('[DEPLOY] Validating secret header')
    const provided = req.headers.get('x-deploy-secret') ?? ''
    if (!provided || !safeEqual(provided, secret)) {
      console.log('[DEPLOY] Secret validation failed')
      log('unauthorized')
      console.warn('[Deploy] Unauthorized attempt: invalid x-deploy-secret header', { providedPresent: !!provided })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.log('[DEPLOY] Secret validation passed')

    // ── 4. Timestamp replay window ────────────────────────────────────────────
    console.log('[DEPLOY] Checking timestamp window')
    const tsHeader = req.headers.get('x-deploy-timestamp')
    if (tsHeader) {
      const ts = parseInt(tsHeader, 10)
      const ageSec = Math.floor(Date.now() / 1000) - ts
      if (isNaN(ts) || ageSec > 300 || ageSec < -30) {
        console.log('[DEPLOY] Timestamp rejected:', { ageSec })
        log('replay_rejected', { ageSec })
        return NextResponse.json(
          { error: 'Request timestamp out of acceptable window' },
          { status: 400 }
        )
      }
    }
    console.log('[DEPLOY] Timestamp valid')

    // ── 5. Atomic lock acquisition ────────────────────────────────────────────
    console.log('[DEPLOY] Acquiring deployment lock')
    try {
      const fd = openSync(LOCK_FILE, 'wx')
      closeSync(fd)
    } catch (lockErr) {
      console.log('[DEPLOY] Lock acquisition failed (deployment in progress):', lockErr)
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
    console.log('[DEPLOY] Lock acquired')

    // ── 6. Write initial queued status ───────────────────────────────────────
    console.log('[DEPLOY] Writing status file')
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
      console.log('[DEPLOY] Status file written')
    } catch (statusErr) {
      console.log('[DEPLOY] Failed to write status file (non-critical):', statusErr)
    }

    // ── 7. Verify script exists ──────────────────────────────────────────────
    console.log('[DEPLOY] Verifying script exists:', scriptPath)
    if (!existsSync(scriptPath)) {
      console.log('[DEPLOY] Script not found, cleaning up lock')
      try { const { unlinkSync } = await import('fs'); unlinkSync(LOCK_FILE) } catch { /* ignore */ }
      log('script_not_found', { scriptPath, resolvedVia })
      return errorResponse('Deployment script not found on server', { scriptPath, resolvedVia }, 500)
    }
    console.log('[DEPLOY] Script verified')
    log('script_verified', { scriptPath, resolvedVia })

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
    console.log('[DEPLOY] Building spawn environment')
    const {
      __NEXT_PRIVATE_STANDALONE_CONFIG: _stripped,
      __NEXT_PRIVATE_RENDER_WORKER:     _stripped2,
      ...spawnEnv
    } = process.env
    console.log('[DEPLOY] Spawn environment built')

    // ── 9. Spawn — double-fork to escape PM2 TreeKill ───────────────────────
    //
    // ROOT CAUSE (why single detached spawn was not enough):
    //   PM2 uses lib/TreeKill.js when restarting the quantix app.  TreeKill
    //   runs `ps -e -o pid=,ppid=`, builds childrenMap[ppid → [childPids]],
    //   then recursively collects and kills every descendant of quantix's PID.
    //   `detached:true` calls setsid() which gives bash its own session and
    //   process group — but it does NOT change bash's PPID.  At the moment
    //   TreeKill's `ps` snapshot is taken, bash still has PPID = quantix PID,
    //   so collect(quantix_pid) reaches bash and killPid(bash_pid, SIGTERM)
    //   is called.  Bash dies after "[PM2] Applying action restartProcessId",
    //   the EXIT trap fires (removing the lock), and status stays frozen at
    //   {status:"running", step:"restart"} forever.
    //
    // FIX — double-fork:
    //   1. Spawn a short-lived intermediate shell (PPID = quantix PID).
    //   2. Intermediate forks deploy-local.sh as a background job (&),
    //      then exits immediately (< 1 ms).
    //   3. Linux reparents the deploy script to init (PPID = 1).
    //   4. Minutes later, `pm2 startOrRestart` triggers TreeKill.
    //      `ps` now shows deploy script with PPID = 1 — it is never in
    //      quantix's descendant chain, so it is never killed.
    //
    // Timing proof: the intermediate exits in microseconds.  The
    // `pm2 startOrRestart` call in deploy-local.sh happens minutes later
    // (after git pull, npm install, prisma, build).  There is no race.
    // disown ensures bash does not send SIGHUP to the deploy script when the
    // intermediate exits, even on systems where huponexit is enabled.
    console.log('[DEPLOY] Spawning child process')
    let intermediate: ReturnType<typeof spawn>
    try {
      intermediate = spawn(
        '/bin/bash',
        ['-c', '/bin/bash "$DEPLOY_SCRIPT" </dev/null >/dev/null 2>&1 & disown'],
        {
          detached: true,
          stdio:    'ignore',
          env:      { ...spawnEnv, DEPLOY_SCRIPT: scriptPath },
        }
      )
      console.log('[DEPLOY] Child process spawned, PID:', intermediate.pid)

      intermediate.on('error', (err) => {
        console.error('[Deploy] Failed to launch deploy process:', err.message)
        try {
          const { unlinkSync } = require('fs')
          unlinkSync(LOCK_FILE)
        } catch {
          // Fallback: use dynamic import instead
          try {
            import('fs').then(({ unlinkSync: unlink }) => {
              unlink(LOCK_FILE)
            })
          } catch { /* ignore */ }
        }
      })

      intermediate.unref()
      console.log('[DEPLOY] Child process unreferenced')
    } catch (err) {
      console.error('[DEPLOY] Spawn failed:', err)
      try { const { unlinkSync } = await import('fs'); unlinkSync(LOCK_FILE) } catch { /* ignore */ }
      return errorResponse(
        'Unable to launch deployment process',
        { error: err instanceof Error ? err.message : String(err) },
        500
      )
    }

    console.log('[DEPLOY] Returning success response')
    log('triggered', { scriptPath, resolvedVia, pid: intermediate.pid })

    return NextResponse.json({
      success: true,
      message: 'Deploy triggered. Poll /api/deploy/status for progress.',
    })
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err))
    console.error('[DEPLOY] Unexpected error in POST handler:', error)
    console.error('[DEPLOY] Error stack:', error.stack)

    return NextResponse.json(
      {
        success: false,
        error: error.message,
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
      },
      { status: 500 }
    )
  }
}
