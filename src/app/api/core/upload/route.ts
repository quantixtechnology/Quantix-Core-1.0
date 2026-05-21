// ============================================================================
// QUANTIX CORE — File Upload API
// POST /api/core/upload — Upload product image (auth required)
// Returns: { success: true, url: "/uploads/products/<businessId>/<filename>" }
//
// Files are written to UPLOAD_ROOT (env var), which defaults to
// <cwd>/public/uploads in dev and /root/uploads in production.
// UPLOAD_ROOT lives outside .next/ so it survives rebuilds.
// ============================================================================

import { NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { withMiddleware } from '@/lib/middleware';
import { UPLOAD_ROOT, ensureDir } from '@/lib/upload-root';

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export const POST = withMiddleware({ requireAuth: true })(async (req) => {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const businessId = (formData.get('businessId') as string) || req.user!.businessId || 'shared';

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ success: false, error: 'Only JPEG, PNG, WebP, and GIF are allowed' }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ success: false, error: 'File must be under 5 MB' }, { status: 400 });
    }

    const ext      = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    // ensureDir creates UPLOAD_ROOT/products/<businessId>/ if missing
    const uploadDir = await ensureDir(join('products', businessId));
    const filePath  = join(uploadDir, safeName);
    const buffer    = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    console.log(`[upload] saved to ${filePath} (UPLOAD_ROOT=${UPLOAD_ROOT})`);

    // URL is always /uploads/... — the files route maps it to UPLOAD_ROOT on disk
    const url = `/uploads/products/${businessId}/${safeName}`;

    return NextResponse.json({ success: true, url, filename: safeName });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
