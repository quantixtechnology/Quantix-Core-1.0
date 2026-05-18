// ============================================================================
// GET    /api/admin/documents/[id]  — Full document (incl. formSnapshot) for PDF render
// PATCH  /api/admin/documents/[id]  — Soft-archive a document (documents:delete)
// DELETE /api/admin/documents/[id]  — Hard delete (documents:delete, Super Admin only)
//
// Soft archive sets status = "ARCHIVED" + deletedAt + deletedBy.
// Documents are never permanently removed unless Super Admin explicitly hard-deletes.
// ============================================================================

import { NextResponse } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'
import type { NextRequest } from 'next/server'

interface AuthenticatedRequest extends NextRequest {
  user?: { id: string; name: string; email: string; role: string }
}

type Ctx = { params?: Promise<Record<string, string | string[]>> }

// ── GET — full document for PDF regeneration ──────────────────────────────────
export const GET = withMiddleware({
  requireAuth: true,
  requiredPermission: 'documents:view',
})(async (_req: NextRequest, ctx?: Ctx) => {
  try {
    const params = await ctx?.params
    const id = params?.id as string | undefined
    if (!id) return createErrorResponse('Missing document id', 400)

    const doc = await db.proposalDocument.findUnique({
      where: { id },
      select: {
        id: true, proposalId: true, documentType: true, status: true,
        businessName: true, clientName: true, contactPhone: true, contactEmail: true,
        leadId: true, salesTeamMember: true, salesTeamEmail: true, totalAmount: true,
        pdfVersion: true, createdBy: true, createdByName: true, createdAt: true,
        formSnapshot: true,
      },
    })
    if (!doc) return createErrorResponse('Document not found', 404)

    return NextResponse.json({ success: true, data: doc })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch document'
    return createErrorResponse(message, 500)
  }
})

// ── PATCH — soft archive ──────────────────────────────────────────────────────
export const PATCH = withMiddleware({
  requireAuth: true,
  requiredPermission: 'documents:delete',
})(async (req: AuthenticatedRequest, ctx?: Ctx) => {
  try {
    const params = await ctx?.params
    const id = params?.id as string | undefined
    if (!id) return createErrorResponse('Missing document id', 400)

    const existing = await db.proposalDocument.findUnique({ where: { id } })
    if (!existing) return createErrorResponse('Document not found', 404)

    const userId = req.user?.id ?? 'unknown'

    const updated = await db.proposalDocument.update({
      where: { id },
      data: {
        status:    'ARCHIVED',
        deletedAt: new Date(),
        deletedBy: userId,
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to archive document'
    return createErrorResponse(message, 500)
  }
})

// ── DELETE — hard delete (Super Admin only) ───────────────────────────────────
export const DELETE = withMiddleware({
  requireAuth: true,
  requiredPermission: 'documents:delete',
})(async (_req: NextRequest, ctx?: Ctx) => {
  try {
    const params = await ctx?.params
    const id = params?.id as string | undefined
    if (!id) return createErrorResponse('Missing document id', 400)

    const existing = await db.proposalDocument.findUnique({ where: { id } })
    if (!existing) return createErrorResponse('Document not found', 404)

    await db.proposalDocument.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete document'
    return createErrorResponse(message, 500)
  }
})
