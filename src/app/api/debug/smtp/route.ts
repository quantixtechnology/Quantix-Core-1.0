// GET /api/debug/smtp
// Returns live process.env SMTP values + working directory.
// localhost / loopback only — never reachable from the public internet.

import { NextRequest, NextResponse } from 'next/server'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

function isLocal(req: NextRequest): boolean {
  const host = req.headers.get('host') || ''
  const fwd  = req.headers.get('x-forwarded-for') || ''
  const rip  = req.headers.get('x-real-ip') || ''
  return (
    host.startsWith('localhost') || host.startsWith('127.0.0.1') ||
    fwd.startsWith('127.') || fwd.startsWith('::1') ||
    rip.startsWith('127.') || rip === '::1' ||
    process.env.NODE_ENV === 'development'
  )
}

export async function GET(req: NextRequest) {
  if (!isLocal(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const cwd = process.cwd()

  // Scan candidate .env files so we know which one exists on disk.
  const candidates = ['.env', '.env.local', '.env.production', '.env.production.local']
  const envFiles: Record<string, boolean> = {}
  for (const f of candidates) {
    envFiles[f] = existsSync(join(cwd, f))
  }

  // Read SMTP lines directly from .env on disk (shows what file actually says,
  // vs what process.env actually loaded — useful when they differ).
  let envFileSmtp: Record<string, string> = {}
  const envPath = join(cwd, '.env')
  if (existsSync(envPath)) {
    const lines = readFileSync(envPath, 'utf8').split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.startsWith('#') || !trimmed.includes('=')) continue
      const [key, ...rest] = trimmed.split('=')
      if (['SMTP_HOST','SMTP_PORT','SMTP_USER','SMTP_PASS','MAIL_FROM','SMTP_FROM','SMTP_SECURE'].includes(key.trim())) {
        const val = rest.join('=').replace(/^["']|["']$/g, '')
        envFileSmtp[key.trim()] = key.trim() === 'SMTP_PASS'
          ? `${'*'.repeat(Math.min(val.length, 8))} (${val.length} chars)`
          : val
      }
    }
  }

  return NextResponse.json({
    process_env: {
      SMTP_HOST:  process.env.SMTP_HOST  ?? null,
      SMTP_PORT:  process.env.SMTP_PORT  ?? null,
      SMTP_USER:  process.env.SMTP_USER  ?? null,
      SMTP_PASS:  process.env.SMTP_PASS
        ? `${'*'.repeat(Math.min(process.env.SMTP_PASS.length, 8))} (${process.env.SMTP_PASS.length} chars)`
        : null,
      MAIL_FROM:  process.env.MAIL_FROM  ?? null,
      SMTP_FROM:  process.env.SMTP_FROM  ?? null,
      NODE_ENV:   process.env.NODE_ENV   ?? null,
    },
    env_file_on_disk: envFileSmtp,
    env_files_present: envFiles,
    cwd,
    note: 'If process_env differs from env_file_on_disk, the process loaded a stale env. Run: pm2 restart quantix --update-env',
  })
}
