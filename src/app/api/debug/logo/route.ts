// GET /api/debug/logo
// Returns logo file existence at all expected locations.
// Requires QUANTIX_SUPER_ADMIN role.

import { NextResponse } from 'next/server'
import { withMiddleware } from '@/lib/middleware'
import { existsSync } from 'fs'
import { join, resolve } from 'path'

export const GET = withMiddleware({
  requireAuth: true,
  requiredRoles: ['QUANTIX_SUPER_ADMIN'],
})(async () => {
  const cwd = process.cwd()
  const dirname = __dirname  // API route directory inside .next

  // Next.js standalone serves public/ relative to the standalone server.js directory.
  // The standalone dir is typically: .next/standalone/
  // Build script copies: cp -r public .next/standalone/
  const candidates = [
    { label: 'standalone/public (expected in prod)', path: join(cwd, '.next', 'standalone', 'public', 'quantix-logo.png') },
    { label: 'project public/ (dev)', path: join(cwd, 'public', 'quantix-logo.png') },
    { label: 'cwd-relative logo.svg', path: join(cwd, 'public', 'logo.svg') },
    { label: 'standalone logo.svg', path: join(cwd, '.next', 'standalone', 'public', 'logo.svg') },
  ]

  const checks = candidates.map(c => ({
    label: c.label,
    absolutePath: resolve(c.path),
    existsOnDisk: existsSync(c.path),
  }))

  return NextResponse.json({
    success: true,
    cwd,
    dirname,
    checks,
    anyFound: checks.some(c => c.existsOnDisk),
  })
})
