// ============================================================================
// DELETE /api/admin/documents/[id]
// Permanently deletes a document. Restricted to users with documents:delete
// (QUANTIX_SUPER_ADMIN only per RBAC).
// ============================================================================

import { NextResponse } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'
import type { NextRequest } from 'next/server'

export const DELETE = withMiddleware({
  requireAuth: true,
  requiredPermission: 'documents:delete',
})(async (_req: NextRequest, ctx?: { params?: Promise<Record<string, string | string[]>> }) => {
  try {
    const params = await ctx?.params
    const id = params?.id as string | undefined
    if (!id) return createErrorResponse('Missing document id', 400)

    const existing = await db.proposalDocument.findUnique({ where: { id } })
    if (!existing) {
      return createErrorResponse('Document not found', 404)
    }

    await db.proposalDocument.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete document'
    return createErrorResponse(message, 500)
  }
})
