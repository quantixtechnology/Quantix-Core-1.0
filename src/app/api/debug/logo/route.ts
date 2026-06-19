// GET /api/debug/logo
// Returns logo file existence at all expected locations + confirms API route works.
// TEMP: no auth — production debug only.

import { NextResponse } from 'next/server'
import { existsSync } from 'fs'
import { join } from 'path'

export async function GET() {
  const cwd = process.cwd()

  const projectPublicLogo   = join(cwd, 'public', 'quantix-logo.png')
  const projectPublicSvg    = join(cwd, 'public', 'logo.svg')
  const standaloneLogo      = join(cwd, '.next', 'standalone', 'public', 'quantix-logo.png')
  const standaloneSvg       = join(cwd, '.next', 'standalone', 'public', 'logo.svg')
  const absoluteFallback    = '/root/Quantix-Core-1.0/public/quantix-logo.png'

  return NextResponse.json({
    success: true,
    cwd,
    apiRouteWorking: true,
    servedLogoPath: '/api/assets/logo',
    checks: {
      'project/public/quantix-logo.png':          existsSync(projectPublicLogo),
      'project/public/logo.svg':                  existsSync(projectPublicSvg),
      '.next/standalone/public/quantix-logo.png': existsSync(standaloneLogo),
      '.next/standalone/public/logo.svg':         existsSync(standaloneSvg),
      '/root/absolute-fallback':                  existsSync(absoluteFallback),
    },
    logoSvgExists:     existsSync(projectPublicSvg),
    quantixLogoExists: existsSync(projectPublicLogo),
    standaloneExists:  existsSync(standaloneLogo),
    httpStatus: 200,
  })
}
