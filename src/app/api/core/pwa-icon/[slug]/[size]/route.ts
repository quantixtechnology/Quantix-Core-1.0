// ============================================================================
// GET /api/core/pwa-icon/[slug]/[size]
//
// Serves tenant-specific PWA icons at exact required sizes (192 × 192 and
// 512 × 512 pixels) as valid PNG files.
//
// WHY THIS EXISTS:
//   Chrome's installability checker validates that manifest icon sources
//   actually resolve to images at the declared sizes. Pointing the manifest
//   to an arbitrary uploaded logo (which may be SVG, JPEG, wrong size, etc.)
//   fails the validation silently and prevents beforeinstallprompt from firing.
//   This route guarantees correctly-sized PNGs regardless of what the business
//   uploaded as their logo.
//
// URL pattern:
//   /api/core/pwa-icon/my-store/192.png   → 192 × 192 PNG
//   /api/core/pwa-icon/my-store/512.png   → 512 × 512 PNG
//
// Icon resolution order:
//   1. Business logo from UPLOAD_ROOT (resized to exact square)
//   2. External logo URL (fetched + resized)
//   3. Generated fallback: brand-colour rounded square + initial letter
//
// Cache: 24 hours (stale-while-revalidate 1 hour).
//   Logo URL in DB almost never changes; long cache avoids DB hit on every
//   page-load. The slug-in-URL means different tenants get different cached
//   responses.
// ============================================================================

import { readFile }  from 'fs/promises'
import { join, resolve, extname } from 'path'
import sharp         from 'sharp'
import { db }        from '@/lib/db'
import { UPLOAD_ROOT } from '@/lib/upload-root'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const VALID_SIZES = new Set([192, 512])

// ─── Logo reading ─────────────────────────────────────────────────────────────

async function readLogoBuffer(logoPath: string): Promise<Buffer | null> {
  if (!logoPath) return null

  // External URL
  if (logoPath.startsWith('http://') || logoPath.startsWith('https://')) {
    try {
      const res = await fetch(logoPath, {
        signal: AbortSignal.timeout(6000),
        headers: { 'User-Agent': 'Quantix-PWA-Icon/1.0' },
      })
      if (!res.ok) return null
      return Buffer.from(await res.arrayBuffer())
    } catch { return null }
  }

  // Local path — normalise to a relative path under UPLOAD_ROOT
  // Handles both /uploads/... and /api/core/files/... forms
  let relative = logoPath
  if (relative.startsWith('/api/core/files/')) {
    relative = relative.slice('/api/core/files/'.length)
  } else if (relative.startsWith('/uploads/')) {
    relative = relative.slice('/uploads/'.length)
  } else {
    // Unknown local prefix — try it as-is relative to UPLOAD_ROOT
    relative = relative.replace(/^\//, '')
  }

  try {
    const uploadsRoot = resolve(UPLOAD_ROOT)
    const filePath    = resolve(join(uploadsRoot, relative))
    if (!filePath.startsWith(uploadsRoot)) return null // path traversal guard
    return await readFile(filePath)
  } catch { return null }
}

// ─── Fallback icon generation ─────────────────────────────────────────────────
// Creates a square icon from the brand colour + the business name's initial.

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '').padEnd(6, '0')
  return {
    r: parseInt(h.slice(0, 2), 16) || 16,
    g: parseInt(h.slice(2, 4), 16) || 185,
    b: parseInt(h.slice(4, 6), 16) || 129,
  }
}

async function generateFallback(initial: string, primaryColor: string, size: number): Promise<Buffer> {
  const { r, g, b } = hexToRgb(primaryColor)
  const radius   = Math.round(size * 0.2)
  const fontSize = Math.round(size * 0.44)
  // Use a safe XML entity for the initial in case it contains & < > etc.
  const safeInitial = initial
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`,
    `  <rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="rgb(${r},${g},${b})"/>`,
    `  <text x="${size / 2}" y="${size / 2}" text-anchor="middle" dominant-baseline="central"`,
    `    font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif"`,
    `    font-size="${fontSize}" font-weight="700" fill="white">${safeInitial}</text>`,
    `</svg>`,
  ].join('\n')

  return sharp(Buffer.from(svg))
    .resize(size, size)
    .png({ compressionLevel: 8 })
    .toBuffer()
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(
  _req: Request,
  context: { params: Promise<{ slug: string; size: string }> }
) {
  const { slug, size: rawSize } = await context.params

  // Strip optional .png extension and validate size
  const sizeStr = rawSize.replace(/\.png$/i, '')
  const size    = parseInt(sizeStr, 10)

  if (!VALID_SIZES.has(size)) {
    return new Response('Invalid size. Use 192 or 512.', { status: 400 })
  }

  if (!slug || !/^[a-z0-9-]+$/i.test(slug)) {
    return new Response('Invalid slug.', { status: 400 })
  }

  // ── Look up business ───────────────────────────────────────────────────────
  let name         = 'Q'
  let primaryColor = '#10B981'
  let logoPath: string | null = null

  try {
    const biz = await db.business.findUnique({
      where:  { slug },
      select: { name: true, primaryColor: true, logo: true },
    })
    if (biz) {
      name         = biz.name         || 'Q'
      primaryColor = biz.primaryColor || '#10B981'
      logoPath     = biz.logo         || null
    }
  } catch {
    // DB error — fall through to generated icon
  }

  const initial = name.trim().charAt(0).toUpperCase() || 'Q'

  // ── Build icon ─────────────────────────────────────────────────────────────
  let pngBuffer: Buffer

  const logoBuffer = logoPath ? await readLogoBuffer(logoPath) : null

  if (logoBuffer) {
    try {
      // Check if the source is SVG (sharp handles SVG rasterisation natively)
      const isSvg = extname(logoPath ?? '').toLowerCase() === '.svg'
      const pipeline = sharp(logoBuffer, { density: isSvg ? 300 : undefined })

      pngBuffer = await pipeline
        .resize(size, size, {
          fit:        'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 }, // transparent padding
        })
        .flatten({ background: { r: 255, g: 255, b: 255 } }) // white bg for JPEGs
        .png({ compressionLevel: 8 })
        .toBuffer()
    } catch {
      // sharp failed (corrupt file, unsupported format) — use generated fallback
      pngBuffer = await generateFallback(initial, primaryColor, size)
    }
  } else {
    pngBuffer = await generateFallback(initial, primaryColor, size)
  }

  return new Response(new Uint8Array(pngBuffer), {
    status: 200,
    headers: {
      'Content-Type':          'image/png',
      'Cache-Control':         'public, max-age=86400, stale-while-revalidate=3600',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
