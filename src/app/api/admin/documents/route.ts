// ============================================================================
// GET  /api/admin/documents  — List all stored proposal documents
// POST /api/admin/documents  — Save a generated proposal to the Document Center
// ============================================================================

import { NextResponse } from 'next/server'
import { withMiddleware, createErrorResponse, getPaginationParams } from '@/lib/middleware'
import { db } from '@/lib/db'
import type { NextRequest } from 'next/server'

// ── GET — List documents ──────────────────────────────────────────────────────
export const GET = withMiddleware({
  requireAuth: true,
  requiredPermission: 'documents:view',
})(async (req: NextRequest) => {
  try {
    const { page, limit, skip } = getPaginationParams(req)
    const { searchParams } = new URL(req.url)

    const search      = searchParams.get('search') ?? ''
    const docType     = searchParams.get('type') ?? ''
    const dateFrom    = searchParams.get('dateFrom')
    const dateTo      = searchParams.get('dateTo')

    const where: Record<string, unknown> = {}

    if (search) {
      where.OR = [
        { proposalId:   { contains: search } },
        { businessName: { contains: search } },
        { clientName:   { contains: search } },
        { contactPhone: { contains: search } },
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
          businessName: true,
          clientName: true,
          contactPhone: true,
          contactEmail: true,
          salesTeamMember: true,
          salesTeamEmail: true,
          totalAmount: true,
          pdfVersion: true,
          createdBy: true,
          createdByName: true,
          createdAt: true,
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

// ── POST — Save document ──────────────────────────────────────────────────────
export const POST = withMiddleware({
  requireAuth: true,
  requiredPermission: 'proposals:create',
})(async (req: NextRequest) => {
  try {
    const body = await req.json()
    const {
      proposalId, documentType = 'PROPOSAL',
      businessName, clientName, contactPhone, contactEmail,
      salesTeamMember, salesTeamEmail,
      totalAmount, formSnapshot,
      createdBy, createdByName,
    } = body

    if (!proposalId || !businessName || !createdBy) {
      return createErrorResponse('proposalId, businessName, and createdBy are required', 400)
    }

    // Upsert: if same proposalId is saved again (re-download), update snapshot only
    const doc = await db.proposalDocument.upsert({
      where: { proposalId },
      create: {
        proposalId,
        documentType,
        businessName,
        clientName:      clientName      ?? '',
        contactPhone:    contactPhone     ?? null,
        contactEmail:    contactEmail     ?? null,
        salesTeamMember: salesTeamMember  ?? null,
        salesTeamEmail:  salesTeamEmail   ?? null,
        totalAmount:     totalAmount      ?? null,
        formSnapshot:    formSnapshot     ? JSON.stringify(formSnapshot) : '{}',
        createdBy,
        createdByName:   createdByName    ?? null,
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
