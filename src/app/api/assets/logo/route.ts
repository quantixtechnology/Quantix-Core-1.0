// GET /api/assets/logo
// Serves quantix-logo.png from process.cwd()/public/ — works in standalone mode
// regardless of whether .next/standalone/public/ was populated by the build.
// PM2 sets cwd=/root/Quantix-Core-1.0 so the file is always at a known path.

import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

const CANDIDATES = [
  join(process.cwd(), 'public', 'quantix-logo.png'),
  join(process.cwd(), '.next', 'standalone', 'public', 'quantix-logo.png'),
  '/root/Quantix-Core-1.0/public/quantix-logo.png',
]

export async function GET() {
  for (const candidate of CANDIDATES) {
    if (existsSync(candidate)) {
      try {
        const bytes = readFileSync(candidate)
        return new Response(bytes, {
          status: 200,
          headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=86400',
          },
        })
      } catch {
        continue
      }
    }
  }

  return new Response('Logo not found', {
    status: 404,
    headers: { 'Content-Type': 'text/plain' },
  })
}
