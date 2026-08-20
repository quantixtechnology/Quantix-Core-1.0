// ============================================================================
// POST /api/admin/billing/proof-upload
// Accepts multipart/form-data: "file" + "businessId"
// Allowed: PDF, PNG, JPG, JPEG — max 10 MB
// Saves to /uploads/payment-proofs/<businessId>/<filename>
// Returns: { success, url, fileType }
// ============================================================================

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { UPLOAD_ROOT, ensureDir } from '@/lib/upload-root'
import { recordUpload, resolveMeteringTarget } from '@/lib/storage-guard'

const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'application/pdf'])
const MAX_SIZE = 10 * 1024 * 1024

function fileType(mime: string): string {
  if (mime === 'application/pdf') return 'RECEIPT'
  return 'SCREENSHOT'
}

export const POST = withMiddleware({
  requireAuth: true,
  requiredRoles: ['QUANTIX_SUPER_ADMIN', 'PLATFORM_ADMIN', 'FINANCE_TEAM'],
})(async (req: NextRequest) => {
  try {
    const formData  = await req.formData()
    const file      = formData.get('file') as File | null
    const businessId = (formData.get('businessId') as string | null) ?? 'unknown'

    if (!file)                     return createErrorResponse('No file provided', 400)
    if (!ALLOWED_TYPES.has(file.type)) return createErrorResponse('Only PDF, PNG, JPEG allowed', 400)
    if (file.size > MAX_SIZE)      return createErrorResponse('File must be under 10 MB', 400)

    const ext      = file.name.split('.').pop()?.toLowerCase() ?? 'png'
    const safeName = `proof-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`

    const uploadDir = await ensureDir(join('payment-proofs', businessId))
    await writeFile(join(uploadDir, safeName), Buffer.from(await file.arrayBuffer()))

    const url = `/uploads/payment-proofs/${businessId}/${safeName}`

    // Metered but never refused. A payment proof is how a business settles its
    // bill — blocking it at the quota would stop them paying to raise it.
    const target = await resolveMeteringTarget(businessId)
    if (target) {
      await recordUpload({
        platformBusinessId: target.platformBusinessId,
        originalName: file.name,
        filename: safeName,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        uploadPath: url,
        category: 'documents',
      })
    }
    return NextResponse.json({ success: true, url, fileType: fileType(file.type) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed'
    return createErrorResponse(message, 500)
  }
})
