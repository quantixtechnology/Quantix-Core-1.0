// ============================================================================
// GET /api/core/files/[...path]
// Serves uploaded files from UPLOAD_ROOT (env var).
//
// All storefront components call resolveImageUrl() which maps
//   /uploads/products/<id>/file.jpg → /api/core/files/products/<id>/file.jpg
// so this route is always hit directly without relying on afterFiles rewrites.
//
// UPLOAD_ROOT defaults to <cwd>/public/uploads in dev.
// In production: UPLOAD_ROOT=/var/www/uploads (set in ecosystem.config.js).
//
// If the requested file is missing, we redirect to a type-appropriate
// placeholder SVG rather than returning a bare 404. This prevents broken
// image icons across all clients (web, Flutter, mobile browser).
// ============================================================================

import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join, extname, resolve } from 'path';
import { UPLOAD_ROOT } from '@/lib/upload-root';

const MIME: Record<string, string> = {
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.webp': 'image/webp',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.pdf':  'application/pdf',
};

// Infer which placeholder to use from the requested path segments.
function placeholderFor(pathSegments: string[]): string {
  const joined = pathSegments.join('/')
  if (joined.startsWith('categories/'))              return '/placeholder-category.svg'
  if (joined.startsWith('logos/') || joined.startsWith('business/')) return '/placeholder-logo.svg'
  if (joined.startsWith('favicons/'))                return '/placeholder-logo.svg'
  return '/placeholder-product.svg'
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await context.params;

    // Resolve path segments against UPLOAD_ROOT
    const uploadsRoot = resolve(UPLOAD_ROOT);
    const filePath    = resolve(join(uploadsRoot, ...path));

    // Prevent path traversal attacks
    if (!filePath.startsWith(uploadsRoot)) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    const data = await readFile(filePath);
    const ext  = extname(filePath).toLowerCase();

    return new NextResponse(data, {
      headers: {
        'Content-Type':  MIME[ext] ?? 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    // File missing — redirect to an appropriate placeholder so clients never
    // see a broken image icon. The placeholder is served from /public/ by Next.js.
    const { path } = await context.params;
    const placeholder = placeholderFor(path);
    return NextResponse.redirect(new URL(placeholder, _req.url), {
      status: 302,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
