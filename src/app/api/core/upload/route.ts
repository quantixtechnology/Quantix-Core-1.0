// ============================================================================
// QUANTIX CORE — File Upload API
// POST /api/core/upload — Upload product image (auth required)
// Returns: { success: true, url: "/uploads/products/<businessId>/<filename>" }
//
// Files are written to UPLOAD_ROOT (env var), which defaults to
// <cwd>/public/uploads in dev and /var/www/uploads in production.
// UPLOAD_ROOT lives outside .next/ so it survives rebuilds.
// ============================================================================

import { NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { withMiddleware } from '@/lib/middleware';
import { UPLOAD_ROOT, ensureDir } from '@/lib/upload-root';

// 20 MB — aligned with the platform upload infra (next.config serverActions
// bodySizeLimit '20mb' + the 20MB reverse-proxy target). The previous 5 MB app
// cap silently rejected normal phone marketing photos even though the infra
// allowed them.
const MAX_MB = 20;
const MAX_SIZE = MAX_MB * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'image/svg+xml',                    // SVG for logos
  'image/x-icon', 'image/vnd.microsoft.icon', // ICO for favicons
]);

export const POST = withMiddleware({ requireAuth: true })(async (req) => {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const businessId = (formData.get('businessId') as string) || req.user!.businessId || 'shared';
    // Optional folder override — defaults to 'products' for backward compat
    const folder = (formData.get('folder') as string)?.replace(/[^a-z0-9_-]/gi, '') || 'products';

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ success: false, error: 'Only JPEG, PNG, WebP, GIF, SVG, and ICO are allowed' }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ success: false, error: `Image is too large. Maximum size is ${MAX_MB} MB.` }, { status: 400 });
    }

    const ext      = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const uploadDir = await ensureDir(join(folder, businessId));
    const filePath  = join(uploadDir, safeName);
    const buffer    = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    console.log(`[upload] saved to ${filePath} (UPLOAD_ROOT=${UPLOAD_ROOT})`);

    const url = `/uploads/${folder}/${businessId}/${safeName}`;

    return NextResponse.json({ success: true, url, filename: safeName });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
