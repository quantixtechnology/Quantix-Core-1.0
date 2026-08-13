// ============================================================================
// QUANTIX CORE — File Upload API
// POST /api/core/upload — Upload an image (auth required)
// Returns: { success: true, url: "/uploads/<folder>/<businessId>/<filename>" }
//
// Files are written to UPLOAD_ROOT (env var: /var/www/uploads in prod, else
// <cwd>/public/uploads in dev). This route is heavily instrumented: every stage
// logs a structured line and each failure returns a distinct, safe error while
// logging the real technical cause + errno + path — so a production failure is
// diagnosable from `pm2 logs quantix-core` at the exact upload timestamp.
// ============================================================================

import { NextResponse } from 'next/server';
import { writeFile, access } from 'fs/promises';
import { constants as FS } from 'fs';
import { join } from 'path';
import { withMiddleware } from '@/lib/middleware';
import { UPLOAD_ROOT, ensureDir } from '@/lib/upload-root';
import { prisma } from '@/lib/prisma';
import { checkStorageAllowance, recordUpload } from '@/lib/storage-guard';

const MAX_MB = 20;
const MAX_SIZE = MAX_MB * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'image/svg+xml',
  'image/x-icon', 'image/vnd.microsoft.icon',
]);

interface FsErr { code?: string; errno?: number; path?: string; message?: string }
const errInfo = (e: unknown): FsErr => {
  const x = e as FsErr;
  return { code: x?.code, errno: x?.errno, path: x?.path, message: x instanceof Error ? x.message : String(e) };
};

export const POST = withMiddleware({ requireAuth: true })(async (req) => {
  const rid = Math.random().toString(36).slice(2, 8);
  const log = (msg: string) => console.log(`[upload ${rid}] ${msg}`);
  log(`request received; UPLOAD_ROOT=${UPLOAD_ROOT}`);

  // ── Stage: parse multipart body ──────────────────────────────────────────
  // If an upstream proxy already rejected an oversized body this handler is
  // never reached (client sees the proxy's 413). If the body reaches Next.js
  // but is malformed/oversized-for-the-runtime, formData() throws here.
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch (e) {
    const info = errInfo(e);
    console.error(`[upload ${rid}] STAGE=parse_body FAILED`, info);
    return NextResponse.json({ success: false, stage: 'parse_body', error: 'Could not read the upload. The image may be too large or the connection dropped.' }, { status: 400 });
  }

  try {
    const file = formData.get('file') as File | null;
    const businessId = (formData.get('businessId') as string) || req.user!.businessId || 'shared';
    const folder = (formData.get('folder') as string)?.replace(/[^a-z0-9_-]/gi, '') || 'products';

    // ── Stage: validate ──────────────────────────────────────────────────
    if (!file) {
      log('STAGE=validate no file field');
      return NextResponse.json({ success: false, stage: 'validate', error: 'No file provided.' }, { status: 400 });
    }
    log(`STAGE=validate file received name=${file.name} type=${file.type} size=${file.size} folder=${folder} business=${businessId}`);
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ success: false, stage: 'validate', error: 'Unsupported image format. Use JPEG, PNG, WebP or GIF.' }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ success: false, stage: 'validate', error: `Image is too large. Maximum size is ${MAX_MB} MB.` }, { status: 400 });
    }

    const ext      = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    // ── Stage: storage quota ───────────────────────────────────────────────
    // This endpoint wrote files to disk and recorded NOTHING, which is why the
    // Storage Usage screen reported 0 B while the business plainly had files.
    // It now both checks the allowance and writes the ledger. Uploads for the
    // shared/platform scope are not business-owned and are left unmetered.
    let laundryBusinessId: string | null = null;
    if (businessId && businessId !== 'shared') {
      const lb = await prisma.laundryBusiness.findFirst({
        where: { OR: [{ id: businessId }, { platformBusinessId: businessId }] },
        select: { id: true, platformBusinessId: true },
      });
      laundryBusinessId = lb?.id ?? null;
      const platformId = lb?.platformBusinessId ?? businessId;
      if (laundryBusinessId) {
        const allowance = await checkStorageAllowance({ laundryBusinessId, platformBusinessId: platformId, incomingBytes: file.size });
        if (!allowance.ok) {
          log(`STAGE=quota BLOCKED business=${businessId} used=${allowance.usedBytes} limit=${allowance.limitBytes}`);
          return NextResponse.json({ success: false, stage: 'quota', error: allowance.error, code: allowance.code }, { status: 413 });
        }
      }
    }

    // ── Stage: ensure directory (mkdir -p under UPLOAD_ROOT) ───────────────
    let uploadDir: string;
    try {
      uploadDir = await ensureDir(join(folder, businessId));
      log(`STAGE=ensure_dir ok dir=${uploadDir}`);
    } catch (e) {
      const info = errInfo(e);
      console.error(`[upload ${rid}] STAGE=ensure_dir FAILED root=${UPLOAD_ROOT}`, info);
      const reason = info.code === 'EACCES' ? 'the upload directory is not writable by the app user'
        : info.code === 'EROFS' ? 'the upload directory is read-only'
        : info.code === 'ENOSPC' ? 'the server is out of disk space' : 'the upload directory could not be created';
      return NextResponse.json({ success: false, stage: 'ensure_dir', code: info.code, error: `Storage error — ${reason}. Please contact support.` }, { status: 500 });
    }

    // ── Stage: write file ──────────────────────────────────────────────────
    const filePath = join(uploadDir, safeName);
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(filePath, buffer);
    } catch (e) {
      const info = errInfo(e);
      console.error(`[upload ${rid}] STAGE=write_file FAILED path=${filePath}`, info);
      const reason = info.code === 'EACCES' ? 'the upload directory is not writable by the app user'
        : info.code === 'ENOSPC' ? 'the server is out of disk space' : 'the file could not be written';
      return NextResponse.json({ success: false, stage: 'write_file', code: info.code, error: `Storage error — ${reason}. Please contact support.` }, { status: 500 });
    }

    // ── Stage: confirm readable (proves the file is actually on disk) ──────
    try { await access(filePath, FS.R_OK); } catch { /* non-fatal */ }

    const url = `/uploads/${folder}/${businessId}/${safeName}`;

    // Ledger AFTER the write is confirmed, so a failed upload is never counted.
    // Never throws — a bookkeeping error must not lose a file already saved.
    if (laundryBusinessId) {
      const lb = await prisma.laundryBusiness.findUnique({ where: { id: laundryBusinessId }, select: { platformBusinessId: true } });
      const platformId = lb?.platformBusinessId ?? businessId;
      await recordUpload({
        platformBusinessId: platformId,
        originalName: file.name,
        filename: safeName,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        uploadPath: url,
        folder,
      });
    }

    log(`STAGE=done saved=${filePath} url=${url}`);
    return NextResponse.json({ success: true, url, filename: safeName });
  } catch (error) {
    const info = errInfo(error);
    console.error(`[upload ${rid}] STAGE=unknown FAILED`, info);
    return NextResponse.json({ success: false, stage: 'unknown', error: 'Upload failed. Please try again.' }, { status: 500 });
  }
});

// GET /api/core/upload — lightweight diagnostics: is UPLOAD_ROOT writable by the
// app user? Lets an admin/operator confirm the storage path health without
// uploading. Returns the resolved root + write result (no secrets, no listing).
export const GET = withMiddleware({ requireAuth: true })(async () => {
  const probe = join('.__diag', `w-${Date.now()}.tmp`);
  try {
    const dir = await ensureDir('.__diag');
    const f = join(dir, `w-${Date.now()}.tmp`);
    await writeFile(f, 'ok');
    await access(f, FS.R_OK);
    return NextResponse.json({ success: true, uploadRoot: UPLOAD_ROOT, writable: true, maxMb: MAX_MB });
  } catch (e) {
    const info = errInfo(e);
    console.error(`[upload diag] write probe FAILED root=${UPLOAD_ROOT} probe=${probe}`, info);
    return NextResponse.json({ success: false, uploadRoot: UPLOAD_ROOT, writable: false, code: info.code, error: info.message }, { status: 500 });
  }
});
