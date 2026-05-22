// ============================================================================
// POST /api/business/logo/upload
// Dedicated business logo / favicon upload.
// Does NOT use withMiddleware — authenticates manually so request.formData()
// is the very first body read and no middleware can consume the stream.
//
// FormData fields:
//   file       — the image file
//   businessId — target business ID (cuid)
//   field      — "logo" | "favicon"  (which DB column to update)
//
// Returns: { success: true, url: string, field: string }
// Side-effect: updates Business.logo or Business.favicon immediately
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join, extname } from 'path';
import { db } from '@/lib/db';
import { UPLOAD_ROOT, ensureDir } from '@/lib/upload-root';

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

// Extension → MIME fallback (used when browser reports empty file.type)
const EXT_MIME: Record<string, string> = {
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.webp': 'image/webp',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
};

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'image/x-icon',
  'image/vnd.microsoft.icon',
]);

function resolveMime(file: File): string {
  if (file.type && ALLOWED_MIME.has(file.type)) return file.type;
  // Fallback: derive from extension
  const ext = extname(file.name).toLowerCase();
  return EXT_MIME[ext] ?? file.type ?? '';
}

// ---- Auth ----
// Mirrors the same token → RefreshToken lookup used by withMiddleware.
// The bearer token sent by the admin UI IS the RefreshToken.token value.
async function authenticate(req: NextRequest): Promise<{ userId: string; role: string } | null> {
  const authHeader = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!authHeader) {
    console.log('[logo/upload] auth: no Authorization header');
    return null;
  }
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    console.log('[logo/upload] auth: empty token after stripping Bearer prefix');
    return null;
  }

  try {
    const rt = await db.refreshToken.findUnique({
      where: { token },
      include: {
        user: {
          select: {
            id: true,
            isActive: true,
            platformRole: true,
            businessUsers: {
              where: { isActive: true },
              select: { role: true },
            },
          },
        },
      },
    });

    if (!rt) { console.log('[logo/upload] auth: token not found in RefreshToken table'); return null; }
    if (rt.expiresAt < new Date()) { console.log('[logo/upload] auth: token expired'); return null; }
    if (!rt.user.isActive) { console.log('[logo/upload] auth: user inactive'); return null; }

    const platRoles = ['QUANTIX_SUPER_ADMIN', 'PLATFORM_ADMIN', 'QUANTIX_SALES_TEAM', 'SUPPORT_TEAM', 'DEPLOYMENT_TEAM', 'FINANCE_TEAM'];
    const platformRole = rt.user.platformRole ?? '';
    if (platRoles.includes(platformRole)) {
      return { userId: rt.user.id, role: platformRole };
    }

    const bizRole = rt.user.businessUsers[0]?.role;
    if (bizRole && ['CLIENT_OWNER', 'STORE_MANAGER', 'STORE_STAFF'].includes(bizRole)) {
      return { userId: rt.user.id, role: bizRole };
    }

    console.log(`[logo/upload] auth: insufficient role — platformRole="${platformRole}", bizRoles=${JSON.stringify(rt.user.businessUsers.map(b => b.role))}`);
    return null;
  } catch (err) {
    console.error('[logo/upload] auth DB error:', err);
    return null;
  }
}

export async function POST(req: NextRequest) {
  console.log('[logo/upload] ▶ POST received');

  try {
    // ── 1. Auth ──────────────────────────────────────────────────────────────
    const authResult = await authenticate(req);
    if (!authResult) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    console.log(`[logo/upload] authenticated userId=${authResult.userId} role=${authResult.role}`);

    // ── 2. Parse FormData ─────────────────────────────────────────────────────
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch (err) {
      console.error('[logo/upload] formData parse error:', err);
      return NextResponse.json({ success: false, error: 'Failed to parse form data — ensure Content-Type is NOT set manually (let browser set multipart boundary)' }, { status: 400 });
    }

    const file       = formData.get('file') as File | null;
    const businessId = (formData.get('businessId') as string | null)?.trim();
    const fieldRaw   = (formData.get('field') as string | null)?.trim() ?? 'logo';
    const field      = (fieldRaw === 'favicon' ? 'favicon' : 'logo') as 'logo' | 'favicon';
    const folder     = field === 'favicon' ? 'favicons' : 'logos';

    console.log(`[logo/upload] businessId="${businessId}" field="${field}" file=${file ? `${file.name} (${file.size}B, type="${file.type}")` : 'null'}`);

    // ── 3. Validate ───────────────────────────────────────────────────────────
    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided — form field name must be "file"' }, { status: 400 });
    }
    if (!businessId) {
      return NextResponse.json({ success: false, error: 'businessId is required' }, { status: 400 });
    }

    const mime = resolveMime(file);
    console.log(`[logo/upload] resolved MIME="${mime}"`);

    if (!ALLOWED_MIME.has(mime)) {
      return NextResponse.json(
        { success: false, error: `File type "${mime || 'unknown'}" not allowed. Use JPEG, PNG, WebP, GIF, SVG, or ICO.` },
        { status: 400 }
      );
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ success: false, error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 5 MB.` }, { status: 400 });
    }

    // ── 4. Compute paths ──────────────────────────────────────────────────────
    const ext      = extname(file.name).toLowerCase() || '.png';
    const safeName = `${field}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}${ext}`;
    const subPath  = join('business', businessId, folder);

    let uploadDir: string;
    try {
      uploadDir = await ensureDir(subPath);
    } catch (err) {
      console.error(`[logo/upload] mkdir failed for ${subPath}:`, err);
      return NextResponse.json({ success: false, error: `Could not create upload directory: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 });
    }

    const filePath = join(uploadDir, safeName);
    console.log(`[logo/upload] writing to ${filePath}`);

    // ── 5. Write file ─────────────────────────────────────────────────────────
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(filePath, buffer);
      console.log(`[logo/upload] ✓ file written (${buffer.length} bytes) → ${filePath}`);
    } catch (err) {
      console.error(`[logo/upload] writeFile failed:`, err);
      return NextResponse.json({ success: false, error: `File write failed: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 });
    }

    const url = `/uploads/business/${businessId}/${folder}/${safeName}`;

    // ── 6. Update DB ──────────────────────────────────────────────────────────
    try {
      await db.business.update({
        where: { id: businessId },
        data: { [field]: url },
      });
      console.log(`[logo/upload] ✓ DB updated Business.${field}="${url}"`);
    } catch (dbErr) {
      console.error(`[logo/upload] DB update failed for businessId="${businessId}":`, dbErr);
      return NextResponse.json({
        success: true,
        url,
        field,
        warning: `File uploaded but DB save failed (${dbErr instanceof Error ? dbErr.message : 'unknown'}). Copy the URL and paste it in the edit panel manually.`,
      });
    }

    console.log(`[logo/upload] ✓ complete url="${url}"`);
    return NextResponse.json({ success: true, url, field });

  } catch (error) {
    console.error('[logo/upload] unhandled error:', error);
    return NextResponse.json(
      { success: false, error: `Unexpected error: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}
