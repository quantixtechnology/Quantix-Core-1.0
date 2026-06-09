// ============================================================================
// GET  /api/admin/documents  — List documents (defaults to ACTIVE only)
// POST /api/admin/documents  — Save / upsert a generated proposal
//
// Ownership rules (enforced at DB query level):
//   QUANTIX_SUPER_ADMIN | PLATFORM_ADMIN | SALES_MANAGER → see all proposals
//   All other roles → see only proposals where createdBy = req.user.id
//
// POST always stores req.user.id as createdBy — the client-supplied value is
// ignored to prevent impersonation.
// ============================================================================

import { NextResponse } from 'next/server'
import { withMiddleware, createErrorResponse, getPaginationParams } from '@/lib/middleware'
import { db } from '@/lib/db'
import type { NextRequest } from 'next/server'

interface AuthenticatedRequest extends NextRequest {
  user?: { id: string; name: string; email: string; role: string }
}

// Roles that can view and act on ALL proposals regardless of ownership.
// Every other role is scoped to proposals they personally created.
const PROPOSAL_ADMIN_ROLES = new Set([
  'QUANTIX_SUPER_ADMIN',
  'PLATFORM_ADMIN',
  'SALES_MANAGER',
])

// ── GET ───────────────────────────────────────────────────────────────────────
export const GET = withMiddleware({
  requireAuth: true,
  requiredPermission: 'proposals:view',
})(async (req: AuthenticatedRequest) => {
  try {
    const { page, limit, skip } = getPaginationParams(req)
    const { searchParams } = new URL(req.url)

    const search   = searchParams.get('search')  ?? ''
    const docType  = searchParams.get('type')    ?? ''
    const status   = searchParams.get('status')  ?? 'ACTIVE'   // ACTIVE | ARCHIVED | ALL
    const dateFrom = searchParams.get('dateFrom')
    const dateTo   = searchParams.get('dateTo')

    const where: Record<string, unknown> = {}

    // Ownership filter — non-admin roles can only see their own proposals.
    // Applied at DB query level so pagination counts are also accurate.
    const role = req.user?.role ?? ''
    if (!PROPOSAL_ADMIN_ROLES.has(role)) {
      where.createdBy = req.user?.id
    }

    // Status filter — "ALL" skips filter (admin view)
    if (status !== 'ALL') {
      where.status = status
    }

    if (search) {
      where.OR = [
        { proposalId:   { contains: search } },
        { businessName: { contains: search } },
        { clientName:   { contains: search } },
        { contactPhone: { contains: search } },
        { leadId:       { contains: search } },
      ]
    }
    if (docType) where.documentType = docType
    if (dateFrom || dateTo) {
      where.createdAt = {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo   ? { lte: new Date(dateTo)   } : {}),
      }
    }

    const [total, documents] = await Promise.all([
      db.proposalDocument.count({ where }),
      db.proposalDocument.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          proposalId: true,
          documentType: true,
          status: true,
          businessName: true,
          clientName: true,
          contactPhone: true,
          contactEmail: true,
          leadId: true,
          salesTeamMember: true,
          salesTeamEmail: true,
          totalAmount: true,
          pdfVersion: true,
          createdBy: true,
          createdByName: true,
          createdAt: true,
          deletedAt: true,
          deletedBy: true,
        },
      }),
    ])

    return NextResponse.json({
      success: true,
      data: documents,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch documents'
    return createErrorResponse(message, 500)
  }
})

// ── POST ──────────────────────────────────────────────────────────────────────
export const POST = withMiddleware({
  requireAuth: true,
  requiredPermission: 'proposals:create',
})(async (req: AuthenticatedRequest) => {
  try {
    const body = await req.json()
    const {
      proposalId, documentType = 'PROPOSAL',
      businessName, clientName,
      contactPhone, contactEmail, leadId,
      salesTeamMember, salesTeamEmail,
      totalAmount, formSnapshot,
    } = body

    if (!proposalId || !businessName) {
      return createErrorResponse('proposalId and businessName are required', 400)
    }

    // Always use the server-verified user identity — never trust client-supplied createdBy.
    const createdBy     = req.user?.id   ?? ''
    const createdByName = req.user?.name ?? body.createdByName ?? null

    if (!createdBy) {
      return createErrorResponse('Could not determine authenticated user', 401)
    }

    const doc = await db.proposalDocument.upsert({
      where: { proposalId },
      create: {
        proposalId,
        documentType,
        status:          'ACTIVE',
        businessName,
        clientName:      clientName      ?? '',
        contactPhone:    contactPhone    ?? null,
        contactEmail:    contactEmail    ?? null,
        leadId:          leadId          ?? null,
        salesTeamMember: salesTeamMember ?? null,
        salesTeamEmail:  salesTeamEmail  ?? null,
        totalAmount:     totalAmount     ?? null,
        formSnapshot:    formSnapshot ? JSON.stringify(formSnapshot) : '{}',
        createdBy,
        createdByName,
      },
      update: {
        formSnapshot: formSnapshot ? JSON.stringify(formSnapshot) : '{}',
        pdfVersion:   { increment: 1 },
        updatedAt:    new Date(),
      },
    })

    return NextResponse.json({ success: true, data: doc })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save document'
    return createErrorResponse(message, 500)
  }
})
