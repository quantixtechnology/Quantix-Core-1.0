// GET /api/assets/logo
// Serves the platform logo.
// Priority:
//   1. PlatformSettings.logoUrl (uploaded file in UPLOAD_ROOT)
//   2. Static quantix-logo.png candidates (original behaviour — works in standalone)
//
// All consumers (sidebar, login, invoices, proposals) use this single endpoint
// so a logo change in Platform Settings propagates everywhere immediately.

import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { getPlatformSettings } from '@/lib/platform-settings'
import { UPLOAD_ROOT } from '@/lib/upload-root'

const STATIC_CANDIDATES = [
  join(process.cwd(), 'public', 'quantix-logo.png'),
  join(process.cwd(), '.next', 'standalone', 'public', 'quantix-logo.png'),
  '/home/ubuntu/Quantix-Core-1.0/public/quantix-logo.png',
]

function serveFile(path: string, mime: string): Response {
  return new Response(readFileSync(path), {
    headers: { 'Content-Type': mime, 'Cache-Control': 'public, max-age=3600' },
  })
}

export async function GET() {
  const settings = await getPlatformSettings()

  // 1. Uploaded logo
  if (settings.logoUrl && settings.logoUrl.startsWith('/uploads/')) {
    const rel  = settings.logoUrl.replace('/uploads/', '')
    const path = join(UPLOAD_ROOT, rel)
    if (existsSync(path)) {
      try {
        const ext  = path.split('.').pop()?.toLowerCase() ?? 'png'
        const mime = ext === 'svg' ? 'image/svg+xml' : ext === 'webp' ? 'image/webp' : 'image/png'
        return serveFile(path, mime)
      } catch { /* fall through */ }
    }
  }

  // 2. Static fallback
  for (const candidate of STATIC_CANDIDATES) {
    if (existsSync(candidate)) {
      try { return serveFile(candidate, 'image/png') } catch { continue }
    }
  }

  return new Response('Logo not found', {
    status: 404,
    headers: { 'Content-Type': 'text/plain' },
  })
}
