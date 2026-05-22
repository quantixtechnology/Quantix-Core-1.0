// ============================================================================
// POST /api/business/logo/upload
// Dedicated business logo / favicon upload — bypasses withMiddleware entirely
// so FormData is never touched before request.formData() is called.
//
// Body (multipart/form-data):
//   file       — the image file
//   businessId — target business ID
//   field      — "logo" | "favicon"  (determines which DB column is updated)
//   folder     — optional subfolder override (defaults to "logos" or "favicons")
//
// Returns: { success: true, url: string }
// Side-effect: immediately updates Business.logo or Business.favicon in DB
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { db } from '@/lib/db';
import { UPLOAD_ROOT, ensureDir } from '@/lib/upload-root';

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'image/x-icon',
  'image/vnd.microsoft.icon',
]);

async function authenticate(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return null;

  try {
    const refreshToken = await db.refreshToken.findUnique({
      where: { token },
      include: {
        user: {
          select: {
            id: true,
            isActive: true,
            platformRole: true,
            businessUsers: { where: { isActive: true }, select: { role: true } },
          },
        },
      },
    });

    if (!refreshToken || refreshToken.expiresAt < new Date()) return null;
    if (!refreshToken.user.isActive) return null;

    const platRoles = ['QUANTIX_SUPER_ADMIN', 'PLATFORM_ADMIN', 'QUANTIX_SALES_TEAM'];
    const hasPlatformRole =
      refreshToken.user.platformRole &&
      platRoles.includes(refreshToken.user.platformRole);
    const hasBusinessRole = refreshToken.user.businessUsers.some((bu) =>
      ['CLIENT_OWNER', 'STORE_MANAGER'].includes(bu.role)
    );

    if (hasPlatformRole || hasBusinessRole) {
      return refreshToken.user.id;
    }
    return null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await authenticate(req);
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const businessId = (formData.get('businessId') as string | null)?.trim();
    const field = ((formData.get('field') as string | null) ?? 'logo').trim() as 'logo' | 'favicon';
    const folderOverride = (formData.get('folder') as string | null)?.replace(/[^a-z0-9_-]/gi, '');
    const folder = folderOverride || (field === 'favicon' ? 'favicons' : 'logos');

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }
    if (!businessId) {
      return NextResponse.json({ success: false, error: 'businessId is required' }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Only JPEG, PNG, WebP, GIF, SVG, and ICO are allowed' },
        { status: 400 }
      );
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ success: false, error: 'File must be under 5 MB' }, { status: 400 });
    }
    if (field !== 'logo' && field !== 'favicon') {
      return NextResponse.json({ success: false, error: 'field must be "logo" or "favicon"' }, { status: 400 });
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const safeName = `${field}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;

    const uploadDir = await ensureDir(join('business', businessId, folder));
    const filePath = join(uploadDir, safeName);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    console.log(`[business/logo/upload] saved ${field} to ${filePath} (UPLOAD_ROOT=${UPLOAD_ROOT})`);

    const url = `/uploads/business/${businessId}/${folder}/${safeName}`;

    // Auto-save to DB immediately
    try {
      await db.business.update({
        where: { id: businessId },
        data: { [field]: url },
      });
    } catch (dbErr) {
      console.error(`[business/logo/upload] DB update failed for businessId=${businessId}:`, dbErr);
      // File was written successfully — return the URL even if DB update fails
      // The caller can still display and save via the normal edit panel
      return NextResponse.json({
        success: true,
        url,
        warning: 'File saved but DB auto-update failed — save manually via the edit panel',
      });
    }

    return NextResponse.json({ success: true, url, field });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed';
    console.error('[business/logo/upload] error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
