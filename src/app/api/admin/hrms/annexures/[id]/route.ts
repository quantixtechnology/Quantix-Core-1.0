import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'

const withOfferLetter = {
  include: {
    offerLetter: {
      select: {
        offerRef: true, candidateName: true, designation: true,
        joiningDate: true, department: true, workLocation: true,
      },
    },
  },
}

export const GET = withMiddleware({ requireAuth: true, requiredPermission: 'hrms:view' })(
  async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await params
      const annexure = await db.annexure.findFirst({
        where: { id, deletedAt: null },
        ...withOfferLetter,
      })
      if (!annexure) return createErrorResponse('Annexure not found', 404)
      return NextResponse.json({ success: true, data: annexure })
    } catch (e) {
      return createErrorResponse(e instanceof Error ? e.message : 'Failed', 500)
    }
  }
)

export const PUT = withMiddleware({ requireAuth: true, requiredPermission: 'hrms:manage' })(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await params
      const body = await req.json() as { title?: string; content?: string }
      const annexure = await db.annexure.update({
        where: { id },
        data: {
          ...(body.title   !== undefined ? { title:   body.title.trim() } : {}),
          ...(body.content !== undefined ? { content: body.content }     : {}),
        },
        ...withOfferLetter,
      })
      return NextResponse.json({ success: true, data: annexure })
    } catch (e) {
      return createErrorResponse(e instanceof Error ? e.message : 'Failed', 500)
    }
  }
)

export const DELETE = withMiddleware({ requireAuth: true, requiredPermission: 'hrms:manage' })(
  async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await params
      await db.annexure.update({ where: { id }, data: { deletedAt: new Date() } })
      return NextResponse.json({ success: true })
    } catch (e) {
      return createErrorResponse(e instanceof Error ? e.message : 'Failed', 500)
    }
  }
)
