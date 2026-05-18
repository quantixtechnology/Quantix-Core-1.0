// ============================================================================
// QUANTIX CORE — File Upload API
// POST /api/core/upload — Upload product image (auth required)
// Returns: { success: true, url: "/uploads/products/<businessId>/<filename>" }
// ============================================================================

import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { withMiddleware } from '@/lib/middleware';

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

    // Build safe filename: timestamp + sanitised original name
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    // Resolve absolute path inside public/uploads/products/<businessId>/
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'products', businessId);
    await mkdir(uploadDir, { recursive: true });

    const filePath = join(uploadDir, safeName);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    // Public URL served by Next.js static file handling
    const url = `/uploads/products/${businessId}/${safeName}`;

    return NextResponse.json({ success: true, url, filename: safeName });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
