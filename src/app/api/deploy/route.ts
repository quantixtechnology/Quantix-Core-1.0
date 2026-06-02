// ============================================================================
// QUANTIX CORE — Deploy Webhook Trigger
// POST /api/deploy
//
// GitHub Actions calls this endpoint over HTTPS instead of SSHing into the
// VPS directly. The endpoint spawns deploy-local.sh as a DETACHED process
// so the script survives the PM2 restart that happens mid-deploy.
//
// Required env var:
//   DEPLOY_WEBHOOK_SECRET — a strong random string (32+ chars)
//
// Required GitHub secret:
//   DEPLOY_WEBHOOK_SECRET — same value
//   DEPLOY_APP_URL        — e.g. https://app.quantixtechnology.in
// ============================================================================

import { NextResponse } from 'next/server'
import { spawn } from 'child_process'
import { existsSync } from 'fs'
import path from 'path'

const LOCK_FILE = '/tmp/quantix-deploy.lock'
const STATUS_FILE = '/tmp/quantix-deploy-status.json'

function resolveScriptPath(): string {
  // When running in Next.js standalone (.next/standalone/server.js),
  // process.cwd() may be .next/standalone/ — go two levels up to reach the
  // project root where scripts/ lives.
  const candidates = [
    path.join(process.cwd(), 'scripts', 'deploy-local.sh'),
    path.join(process.cwd(), '..', '..', 'scripts', 'deploy-local.sh'),
    path.join(process.cwd(), '..', 'scripts', 'deploy-local.sh'),
  ]
  for (const p of candidates) {
    try {
      if (existsSync(p)) return p
    } catch { /* ignore */ }
  }
  // Fall back to the first candidate — will fail gracefully with a clear error
  return candidates[0]
}

export async function POST(req: Request) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const secret = process.env.DEPLOY_WEBHOOK_SECRET
  if (!secret) {
    console.error('[Deploy] DEPLOY_WEBHOOK_SECRET is not set')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  const provided = req.headers.get('x-deploy-secret')
  if (!provided || provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Lock check ───────────────────────────────────────────────────────────────
  if (existsSync(LOCK_FILE)) {
    let current: Record<string, unknown> = {}
    try {
      const { readFileSync } = await import('fs')
      current = JSON.parse(readFileSync(STATUS_FILE, 'utf-8'))
    } catch { /* ignore */ }
    return NextResponse.json(
      { error: 'Deploy already in progress', current },
      { status: 409 }
    )
  }

  // ── Resolve script ──────────────────────────────────────────────────────────
  const scriptPath = resolveScriptPath()
  if (!existsSync(scriptPath)) {
    return NextResponse.json(
      { error: `Deploy script not found: ${scriptPath}` },
      { status: 500 }
    )
  }

  // ── Spawn detached ──────────────────────────────────────────────────────────
  // detached:true + unref() = the child process becomes its own process group
  // and is completely independent of this Node.js process. When PM2 restarts
  // the app during the build step, the deploy script continues uninterrupted.
  const child = spawn('bash', [scriptPath], {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env },
  })

  child.on('error', (err) => {
    console.error('[Deploy] Failed to spawn deploy script:', err)
  })

  child.unref()

  console.log(`[Deploy] Triggered — PID ${child.pid} — script: ${scriptPath}`)

  return NextResponse.json({
    ok: true,
    pid: child.pid,
    script: scriptPath,
    message: 'Deploy triggered. Poll /api/deploy/status for progress.',
  })
}

// Disable Next.js body size limit — no body needed, but keeps route clean
export const runtime = 'nodejs'
