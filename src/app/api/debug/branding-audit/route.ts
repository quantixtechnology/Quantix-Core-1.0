// ============================================================================
// GET /api/debug/branding-audit
// Shows raw DB logo/favicon values for all businesses.
// Useful for diagnosing null/broken branding assets after migrations.
//
// Usage:
//   https://YOUR_DOMAIN/api/debug/branding-audit
//   https://YOUR_DOMAIN/api/debug/branding-audit?slug=arbazfreshmeat
// ============================================================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveImageUrl } from '@/lib/image-url'
import { UPLOAD_ROOT } from '@/lib/upload-root'
import { existsSync } from 'fs'
import { join, resolve } from 'path'
import { platformOnly } from "@/lib/platform-guard"

function fileExists(url: string | null): boolean {
  if (!url) return false
  const rel = url.startsWith('/uploads/')
    ? url.slice('/uploads/'.length)
    : url.startsWith('/api/core/files/')
      ? url.slice('/api/core/files/'.length)
      : null
  if (!rel) return false
  const abs = resolve(join(UPLOAD_ROOT, rel))
  return existsSync(abs)
}

export async function GET(req: Request) {
  // Platform staff only — diagnostics/administration, never tenant-reachable.
  const _denied = await platformOnly(req)
  if (_denied) return _denied
  const { searchParams } = new URL(req.url)
  const slug = searchParams.get('slug') ?? undefined

  const where = slug ? { slug } : {}

  const businesses = await db.business.findMany({
    where,
    select: {
      id: true,
      name: true,
      slug: true,
      logo: true,
      favicon: true,
      branding: {
        select: { logo: true, favicon: true, appIcon: true, coverImage: true },
      },
    },
    orderBy: { name: 'asc' },
  })

  const rows = businesses.map(biz => {
    const effectiveLogo    = biz.logo    ?? biz.branding?.logo    ?? null
    const effectiveFavicon = biz.favicon ?? biz.branding?.favicon ?? null

    return {
      id:   biz.id,
      name: biz.name,
      slug: biz.slug,

      business_logo:          biz.logo,
      business_favicon:       biz.favicon,
      branding_logo:          biz.branding?.logo    ?? null,
      branding_favicon:       biz.branding?.favicon ?? null,
      branding_appIcon:       biz.branding?.appIcon ?? null,
      branding_coverImage:    biz.branding?.coverImage ?? null,

      effective_logo:    effectiveLogo,
      effective_favicon: effectiveFavicon,

      resolved_logo:    resolveImageUrl(effectiveLogo),
      resolved_favicon: resolveImageUrl(effectiveFavicon),

      file_logo_exists:    fileExists(effectiveLogo),
      file_favicon_exists: fileExists(effectiveFavicon),

      status: {
        logo_ok:    !!effectiveLogo && fileExists(effectiveLogo),
        favicon_ok: !!effectiveFavicon && fileExists(effectiveFavicon),
        logo_null:  !effectiveLogo,
        favicon_null: !effectiveFavicon,
        logo_missing_file:    !!effectiveLogo && !fileExists(effectiveLogo),
        favicon_missing_file: !!effectiveFavicon && !fileExists(effectiveFavicon),
      },
    }
  })

  const summary = {
    uploadRoot:   UPLOAD_ROOT,
    total:        rows.length,
    logo_ok:      rows.filter(r => r.status.logo_ok).length,
    logo_null:    rows.filter(r => r.status.logo_null).length,
    logo_missing: rows.filter(r => r.status.logo_missing_file).length,
    favicon_ok:      rows.filter(r => r.status.favicon_ok).length,
    favicon_null:    rows.filter(r => r.status.favicon_null).length,
    favicon_missing: rows.filter(r => r.status.favicon_missing_file).length,
  }

  return NextResponse.json({ summary, businesses: rows }, { status: 200 })
}
