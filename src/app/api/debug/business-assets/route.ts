// ============================================================================
// GET /api/debug/business-assets?businessCode=BUS-xxx  OR  ?businessId=xxx
// Diagnostic endpoint — checks logo/favicon upload state + write permissions
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { existsSync, statSync } from 'fs';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join, resolve } from 'path';
import { db } from '@/lib/db';
import { UPLOAD_ROOT } from '@/lib/upload-root';
import { platformOnly } from "@/lib/platform-guard"

export async function GET(req: NextRequest) {
  // Platform staff only — diagnostics/administration, never tenant-reachable.
  const _denied = await platformOnly(req)
  if (_denied) return _denied
  const { searchParams } = new URL(req.url);
  const businessCode = searchParams.get('businessCode');
  const businessId   = searchParams.get('businessId');

  if (!businessCode && !businessId) {
    return NextResponse.json(
      { success: false, error: 'Provide ?businessCode=BUS-xxx or ?businessId=...' },
      { status: 400 }
    );
  }

  // ── 1. Test UPLOAD_ROOT write permission ────────────────────────────────────
  const testPath = join(UPLOAD_ROOT, '_write_test_' + Date.now() + '.txt');
  let writeTest: { ok: boolean; error?: string } = { ok: false };
  try {
    await mkdir(UPLOAD_ROOT, { recursive: true });
    await writeFile(testPath, 'ok');
    await unlink(testPath);
    writeTest = { ok: true };
  } catch (err) {
    writeTest = { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  // ── 2. Look up business ──────────────────────────────────────────────────────
  const where = businessId ? { id: businessId } : { businessCode: businessCode! };
  let business;
  try {
    business = await db.business.findFirst({
      where,
      select: { id: true, name: true, businessCode: true, slug: true, logo: true, favicon: true },
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: 'DB error: ' + (err instanceof Error ? err.message : String(err)) }, { status: 500 });
  }

  if (!business) {
    return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 });
  }

  // ── 3. Resolve file paths ────────────────────────────────────────────────────
  const resolveAsset = (dbValue: string | null) => {
    if (!dbValue) return { dbValue: null, absolutePath: null, exists: false, size: null, publicUrl: null };
    // dbValue: /uploads/business/{id}/logos/logo-xxx.png
    const relativePath = dbValue.replace(/^\/uploads\//, '');
    const absolutePath = resolve(join(UPLOAD_ROOT, relativePath));
    let size: number | null = null;
    let exists = false;
    try {
      const s = statSync(absolutePath);
      exists = true;
      size = s.size;
    } catch {
      exists = false;
    }
    return { dbValue, absolutePath, exists, size, publicUrl: dbValue };
  };

  // ── 4. Check business upload dir ─────────────────────────────────────────────
  const bizLogosDir   = join(UPLOAD_ROOT, 'business', business.id, 'logos');
  const bizFaviconDir = join(UPLOAD_ROOT, 'business', business.id, 'favicons');

  return NextResponse.json({
    success: true,
    uploadRoot: UPLOAD_ROOT,
    writeTest,
    business: {
      name:         business.name,
      id:           business.id,
      businessCode: business.businessCode,
      slug:         business.slug,
    },
    logo:    resolveAsset(business.logo),
    favicon: resolveAsset(business.favicon),
    dirs: {
      logos:    { path: bizLogosDir,   exists: existsSync(bizLogosDir) },
      favicons: { path: bizFaviconDir, exists: existsSync(bizFaviconDir) },
    },
  });
}
