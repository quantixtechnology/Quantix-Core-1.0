import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'

export const GET = withMiddleware({ requireAuth: true, requiredPermission: 'hrms:view' })(
  async (req: NextRequest) => {
    try {
      const { searchParams } = new URL(req.url)
      const offerLetterId = searchParams.get('offerLetterId')
      const page  = Math.max(1, parseInt(searchParams.get('page')  ?? '1'))
      const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '50'))

      const where = {
        deletedAt: null as null,
        ...(offerLetterId ? { offerLetterId } : {}),
      }

      const [rows, total] = await Promise.all([
        db.annexure.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            offerLetter: { select: { offerRef: true, candidateName: true } },
          },
        }),
        db.annexure.count({ where }),
      ])

      return NextResponse.json({
        success: true,
        data: rows,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      })
    } catch (e) {
      return createErrorResponse(e instanceof Error ? e.message : 'Failed', 500)
    }
  }
)

export const POST = withMiddleware({ requireAuth: true, requiredPermission: 'hrms:manage' })(
  async (req: NextRequest) => {
    try {
      const body = await req.json() as {
        offerLetterId: string
        title: string
        content?: string
        templateId?: string
        createdBy?: string
      }

      if (!body.offerLetterId || !body.title?.trim()) {
        return createErrorResponse('offerLetterId and title are required', 400)
      }

      const offerLetter = await db.offerLetter.findUnique({
        where: { id: body.offerLetterId },
        select: { offerRef: true },
      })
      if (!offerLetter) return createErrorResponse('Offer letter not found', 404)

      // Count existing (non-deleted) annexures to assign the next label
      const existingCount = await db.annexure.count({
        where: { offerLetterId: body.offerLetterId, deletedAt: null },
      })
      const label = String.fromCharCode(65 + existingCount) // 0→A, 1→B, 2→C …
      const annexureRef = offerLetter.offerRef ? `${offerLetter.offerRef}-${label}` : null

      const annexure = await db.annexure.create({
        data: {
          offerLetterId: body.offerLetterId,
          label,
          annexureRef,
          title:      body.title.trim(),
          content:    body.content ?? '',
          templateId: body.templateId || undefined,
          createdBy:  body.createdBy,
        },
        include: {
          offerLetter: { select: { offerRef: true, candidateName: true } },
        },
      })

      return NextResponse.json({ success: true, data: annexure }, { status: 201 })
    } catch (e) {
      return createErrorResponse(e instanceof Error ? e.message : 'Failed', 500)
    }
  }
)
