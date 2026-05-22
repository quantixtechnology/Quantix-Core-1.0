// ============================================================================
// GET /api/core/files/[...path]
// Serves uploaded files from UPLOAD_ROOT (env var).
//
// All storefront components call resolveImageUrl() which maps
//   /uploads/products/<id>/file.jpg → /api/core/files/products/<id>/file.jpg
// so this route is always hit directly without relying on afterFiles rewrites.
//
// UPLOAD_ROOT defaults to <cwd>/public/uploads in dev.
// In production: UPLOAD_ROOT=/root/uploads (set in ecosystem.config.js).
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
    return new NextResponse('Not found', { status: 404 });
  }
}
