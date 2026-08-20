import { NextResponse } from 'next/server'
import { getBuildId } from '@/lib/build-id'

export const runtime = 'nodejs'

export async function GET() {
  return NextResponse.json({
    // Stable for the life of this release. `buildTime` below is the time of
    // THIS REQUEST, not of the build — it is kept for compatibility, but it is
    // not an identifier and nothing may compare it against a stored value.
    buildId: getBuildId(),
    buildTime: new Date().toISOString(),
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    version: process.env.npm_package_version || 'unknown',
    commit: process.env.BUILD_ID || process.env.GIT_COMMIT || 'unknown',
    branch: process.env.GIT_BRANCH || 'unknown',
    routeVersion: 'v1',
  })
}
