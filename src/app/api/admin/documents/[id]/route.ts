// ============================================================================
// GET    /api/admin/documents/[id]  — Full document (incl. formSnapshot) for PDF render
// PATCH  /api/admin/documents/[id]  — Soft-archive a document (proposals:delete)
// DELETE /api/admin/documents/[id]  — Hard delete (proposals:delete, Super Admin only)
//
// Ownership enforcement:
//   QUANTIX_SUPER_ADMIN | PLATFORM_ADMIN | SALES_MANAGER → access any document
//   All other roles → 403 if the document was not created by req.user.id
//
// Soft archive sets status = "ARCHIVED" + deletedAt + deletedBy.
// Documents are never permanently removed unless Super Admin explicitly hard-deletes.
// ============================================================================

import { NextResponse } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'
import { logPlatformEvent } from '@/lib/platform-audit'
import type { NextRequest } from 'next/server'

interface AuthenticatedRequest extends NextRequest {
  user?: { id: string; name: string; email: string; role: string }
}

type Ctx = { params?: Promise<Record<string, string | string[]>> }

// Roles that can view and act on ALL proposals regardless of ownership.
const PROPOSAL_ADMIN_ROLES = new Set([
  'QUANTIX_SUPER_ADMIN',
  'PLATFORM_ADMIN',
  'SALES_MANAGER',
])

function isProposalAdmin(role: string | undefined): boolean {
  return PROPOSAL_ADMIN_ROLES.has(role ?? '')
}

// ── GET — full document for PDF regeneration ──────────────────────────────────
export const GET = withMiddleware({
  requireAuth: true,
  requiredPermission: 'proposals:view',
})(async (req: AuthenticatedRequest, ctx?: Ctx) => {
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

    if (!isProposalAdmin(req.user?.role) && doc.createdBy !== req.user?.id) {
      return createErrorResponse('Access denied', 403)
    }

    return NextResponse.json({ success: true, data: doc })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch document'
    return createErrorResponse(message, 500)
  }
})

// ── PATCH — soft archive ──────────────────────────────────────────────────────
export const PATCH = withMiddleware({
  requireAuth: true,
  requiredPermission: 'proposals:delete',
})(async (req: AuthenticatedRequest, ctx?: Ctx) => {
  try {
    const params = await ctx?.params
    const id = params?.id as string | undefined
    if (!id) return createErrorResponse('Missing document id', 400)

    const existing = await db.proposalDocument.findUnique({ where: { id } })
    if (!existing) return createErrorResponse('Document not found', 404)

    if (!isProposalAdmin(req.user?.role) && existing.createdBy !== req.user?.id) {
      return createErrorResponse('Access denied', 403)
    }

    const updated = await db.proposalDocument.update({
      where: { id },
      data: {
        status:    'ARCHIVED',
        deletedAt: new Date(),
        deletedBy: req.user?.id ?? 'unknown',
      },
    })

    logPlatformEvent({
      userId:       req.user?.id,
      userName:     req.user?.name,
      email:        req.user?.email,
      role:         req.user?.role,
      module:       'PROPOSALS',
      action:       'ARCHIVE',
      description:  `Proposal ${existing.proposalId} archived`,
      resourceType: 'Proposal',
      resourceId:   existing.proposalId,
      req,
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
  requiredPermission: 'proposals:delete',
})(async (req: AuthenticatedRequest, ctx?: Ctx) => {
  try {
    const params = await ctx?.params
    const id = params?.id as string | undefined
    if (!id) return createErrorResponse('Missing document id', 400)

    const existing = await db.proposalDocument.findUnique({ where: { id } })
    if (!existing) return createErrorResponse('Document not found', 404)

    if (!isProposalAdmin(req.user?.role) && existing.createdBy !== req.user?.id) {
      return createErrorResponse('Access denied', 403)
    }

    await db.proposalDocument.delete({ where: { id } })

    logPlatformEvent({
      userId:       req.user?.id,
      userName:     req.user?.name,
      email:        req.user?.email,
      role:         req.user?.role,
      module:       'PROPOSALS',
      action:       'DELETE',
      description:  `Proposal ${existing.proposalId} permanently deleted`,
      resourceType: 'Proposal',
      resourceId:   existing.proposalId,
      severity:     'CRITICAL',
      req,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete document'
    return createErrorResponse(message, 500)
  }
})
