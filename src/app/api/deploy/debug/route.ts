// ============================================================================
// GET /api/deploy/debug — Self-diagnostic endpoint
// Returns system state and deployment configuration for remote debugging
// ============================================================================

import { NextResponse } from 'next/server'
import { existsSync } from 'fs'
import { readFileSync } from 'fs'

export const runtime = 'nodejs'

const LOCK_FILE = '/tmp/quantix-deploy.lock'
const STATUS_FILE = '/tmp/quantix-deploy-status.json'

export async function GET() {
  try {
    const projectDir = process.env.QUANTIX_PROJECT_DIR || '/home/ubuntu/Quantix-Core-1.0'
    const scriptPath = `${projectDir}/scripts/deploy-local.sh`

    // Get environment summary (mask secrets)
    const envSummary: Record<string, string> = {}
    const publicEnvVars = [
      'NODE_ENV',
      'NODE_VERSION',
      'npm_package_version',
      'QUANTIX_PROJECT_DIR',
      'PORT',
      'HOSTNAME',
    ]

    for (const key of publicEnvVars) {
      if (process.env[key]) {
        envSummary[key] = process.env[key]!
      }
    }

    // Check file existence and permissions
    const scriptExists = existsSync(scriptPath)
    const statusFileExists = existsSync(STATUS_FILE)
    const lockFileExists = existsSync(LOCK_FILE)

    // Try to read status file
    let statusContent: any = null
    if (statusFileExists) {
      try {
        statusContent = JSON.parse(readFileSync(STATUS_FILE, 'utf-8'))
      } catch {
        // Ignore parse errors
      }
    }

    // Build diagnostic object
    const diagnostic = {
      timestamp: new Date().toISOString(),
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        uptime: process.uptime(),
        memoryUsage: {
          heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          external: Math.round(process.memoryUsage().external / 1024 / 1024),
        },
      },
      environment: envSummary,
      paths: {
        projectDir,
        scriptPath,
        statusFile: STATUS_FILE,
        lockFile: LOCK_FILE,
        cwd: process.cwd(),
      },
      files: {
        scriptExists,
        scriptPath,
        statusFileExists,
        lockFileExists,
        statusContent: statusFileExists ? statusContent : null,
      },
      deployment: {
        locked: lockFileExists,
        inProgress: statusFileExists && statusContent?.status === 'running',
        lastStatus: statusContent || 'none',
      },
      git: {
        commit: process.env.BUILD_ID || 'unknown',
        branch: process.env.GIT_BRANCH || 'unknown',
      },
    }

    return NextResponse.json({
      success: true,
      diagnostic,
    })
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err))
    return NextResponse.json(
      {
        success: false,
        stage: 'debug_endpoint',
        message: error.message,
        stack: error.stack,
      },
      { status: 500 }
    )
  }
}
