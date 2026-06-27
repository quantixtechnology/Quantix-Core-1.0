import { NextResponse } from 'next/server'
import { existsSync, readFileSync } from 'fs'

export const runtime = 'nodejs'

const STATUS_FILE = '/tmp/quantix-deploy-status.json'
const LOG_FILE = '/tmp/quantix-deploy.log'
const LOCK_FILE = '/tmp/quantix-deploy.lock'

export async function GET(req: Request) {
  try {
    // Check auth
    const secret = process.env.DEPLOY_WEBHOOK_SECRET
    const provided = req.headers.get('x-deploy-secret')

    if (!secret || !provided || provided !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Read status file
    if (!existsSync(STATUS_FILE)) {
      return NextResponse.json({ status: 'idle', locked: existsSync(LOCK_FILE) })
    }

    const content = readFileSync(STATUS_FILE, 'utf-8')
    const data = JSON.parse(content)

    // Read log tail
    let tail: string[] = []
    if (existsSync(LOG_FILE)) {
      const lines = readFileSync(LOG_FILE, 'utf-8').split('\n')
      tail = lines.slice(-40).filter(l => l.trim())
    }

    return NextResponse.json({
      ...data,
      locked: existsSync(LOCK_FILE),
      tail,
    })
  } catch (err) {
    return NextResponse.json(
      {
        error: 'Error reading status',
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    )
  }
}
