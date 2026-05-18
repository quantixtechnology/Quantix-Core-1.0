// ============================================================================
// GET /api/core/files/[...path]
// Serves uploaded files from process.cwd()/public/uploads/.
//
// In dev mode, Next.js serves public/ statically so this route is never
// reached. In production standalone the static server only knows about files
// that existed at build time; uploads land in project/public/uploads/ after
// the build. The afterFiles rewrite in next.config.ts sends any unresolved
// /uploads/* request here, and we read the file directly from disk.
// ============================================================================

import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join, extname, resolve } from 'path';

const MIME: Record<string, string> = {
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.webp': 'image/webp',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
};

export async function GET(
  _req: Request,
  context: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await context.params;

    // Reconstruct the path segments and resolve to an absolute path
    const uploadsRoot = resolve(join(process.cwd(), 'public', 'uploads'));
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
