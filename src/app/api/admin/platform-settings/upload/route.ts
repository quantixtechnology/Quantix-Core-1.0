// ============================================================================
// POST   /api/admin/platform-settings/upload
//   Body: multipart — field "file" (image) + "assetField" (logoUrl | darkLogoUrl | faviconUrl | emailLogoUrl)
//   Saves file to /uploads/platform/shared/<safeName>, updates settings, returns new URL.
//
// DELETE /api/admin/platform-settings/upload?assetField=logoUrl
//   Removes the stored file from disk, clears the settings field.
// ============================================================================

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { writeFile, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'
import { UPLOAD_ROOT, ensureDir } from '@/lib/upload-root'
import { invalidatePlatformSettingsCache } from '@/lib/platform-settings'

const ALLOWED_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon',
])
const MAX_SIZE = 5 * 1024 * 1024
const ALLOWED_FIELDS = new Set([
  // Zone 1 — Core Platform
  'logoUrl', 'darkLogoUrl', 'faviconUrl', 'emailLogoUrl',
  'compactLogoUrl', 'watermarkUrl',
  // Zone 2 — Sales Documents
  'salesLogoUrl', 'salesWatermarkUrl',
  // Zone 3 — HRMS
  'hrmsLogoUrl', 'hrmsWatermarkUrl',
  'signatorySignUrl', 'signatoryStampUrl',
])

export const POST = withMiddleware({
  requireAuth: true,
  requiredPermission: 'settings:edit',
})(async (req: NextRequest) => {
  try {
    const formData   = await req.formData()
    const file       = formData.get('file') as File | null
    const assetField = formData.get('assetField') as string | null

    if (!file)        return createErrorResponse('No file provided', 400)
    if (!assetField || !ALLOWED_FIELDS.has(assetField))
      return createErrorResponse('Invalid assetField', 400)
    if (!ALLOWED_TYPES.has(file.type))
      return createErrorResponse('Only JPEG, PNG, WebP, GIF, SVG, ICO allowed', 400)
    if (file.size > MAX_SIZE)
      return createErrorResponse('File must be under 5 MB', 400)

    const ext      = file.name.split('.').pop()?.toLowerCase() || 'png'
    const safeName = `${assetField}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`

    const uploadDir = await ensureDir(join('platform', 'shared'))
    await writeFile(join(uploadDir, safeName), Buffer.from(await file.arrayBuffer()))

    const url = `/uploads/platform/shared/${safeName}`

    // If there was a previous file for this field, delete it
    const existing = await db.platformSettings.findFirst({ select: { [assetField]: true } as Record<string, true> })
    const oldUrl = existing?.[assetField as keyof typeof existing] as string | null | undefined
    if (oldUrl && oldUrl.startsWith('/uploads/')) {
      const oldPath = join(UPLOAD_ROOT, oldUrl.replace('/uploads/', ''))
      if (existsSync(oldPath)) await unlink(oldPath).catch(() => { /* ignore */ })
    }

    const row = await db.platformSettings.upsert({
      where:  { id: 'singleton' },
      update: { [assetField]: url },
      create: { id: 'singleton', [assetField]: url },
    })

    invalidatePlatformSettingsCache()
    return NextResponse.json({ success: true, url, data: row })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed'
    return createErrorResponse(message, 500)
  }
})

export const DELETE = withMiddleware({
  requireAuth: true,
  requiredPermission: 'settings:edit',
})(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url)
    const assetField = searchParams.get('assetField')

    if (!assetField || !ALLOWED_FIELDS.has(assetField))
      return createErrorResponse('Invalid assetField', 400)

    const existing = await db.platformSettings.findFirst({ select: { [assetField]: true } as Record<string, true> })
    const oldUrl = existing?.[assetField as keyof typeof existing] as string | null | undefined

    if (oldUrl && oldUrl.startsWith('/uploads/')) {
      const oldPath = join(UPLOAD_ROOT, oldUrl.replace('/uploads/', ''))
      if (existsSync(oldPath)) await unlink(oldPath).catch(() => { /* ignore */ })
    }

    const row = await db.platformSettings.upsert({
      where:  { id: 'singleton' },
      update: { [assetField]: null },
      create: { id: 'singleton' },
    })

    invalidatePlatformSettingsCache()
    return NextResponse.json({ success: true, data: row })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Delete failed'
    return createErrorResponse(message, 500)
  }
})
