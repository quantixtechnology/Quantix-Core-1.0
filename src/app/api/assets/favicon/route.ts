// GET /api/assets/favicon
// Serves the platform favicon from DB settings → UPLOAD_ROOT fallback → 404.
// Referenced in layout.tsx <link rel="icon"> so the browser always uses the
// currently configured favicon without a cache bust.

import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { getPlatformSettings } from '@/lib/platform-settings'
import { UPLOAD_ROOT } from '@/lib/upload-root'

const MIME: Record<string, string> = {
  png: 'image/png',
  ico: 'image/x-icon',
  svg: 'image/svg+xml',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
}

export async function GET() {
  const settings = await getPlatformSettings()

  if (settings.faviconUrl) {
    const rel  = settings.faviconUrl.replace('/uploads/', '')
    const path = join(UPLOAD_ROOT, rel)
    if (existsSync(path)) {
      const ext  = path.split('.').pop()?.toLowerCase() ?? 'png'
      const mime = MIME[ext] ?? 'image/png'
      try {
        return new Response(readFileSync(path), {
          headers: { 'Content-Type': mime, 'Cache-Control': 'public, max-age=3600' },
        })
      } catch { /* fall through */ }
    }
  }

  return new Response('Favicon not configured', {
    status: 404,
    headers: { 'Content-Type': 'text/plain' },
  })
}
