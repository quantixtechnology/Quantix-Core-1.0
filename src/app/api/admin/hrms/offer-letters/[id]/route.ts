import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'

type Ctx = { params?: Promise<Record<string, string | string[]>> }

const getId = async (ctx?: Ctx) => {
  const p = await ctx?.params
  return Array.isArray(p?.id) ? p?.id[0] : p?.id
}

export const GET = withMiddleware({ requireAuth: true, requiredPermission: 'hrms:view' })(
  async (_req: NextRequest, ctx?: Ctx) => {
    try {
      const id = await getId(ctx)
      if (!id) return createErrorResponse('id required', 400)
      const letter = await db.offerLetter.findUnique({
        where: { id },
        include: { template: { select: { id: true, name: true } } },
      })
      if (!letter || letter.deletedAt) return createErrorResponse('Not found', 404)
      return NextResponse.json({ success: true, data: letter })
    } catch (e) {
      return createErrorResponse(e instanceof Error ? e.message : 'Failed', 500)
    }
  }
)

export const PUT = withMiddleware({ requireAuth: true, requiredPermission: 'hrms:manage' })(
  async (req: NextRequest, ctx?: Ctx) => {
    try {
      const id = await getId(ctx)
      if (!id) return createErrorResponse('id required', 400)
      const body = await req.json() as {
        status?: string
        content?: string
        sentBy?: string
        performedBy?: string
        // Draft-edit fields — only applied when offerRef not yet assigned
        candidateName?: string
        candidateEmail?: string
        candidateMobile?: string
        designation?: string
        department?: string
        reportingManager?: string
        workLocation?: string
        joiningDate?: string
        employmentType?: string
        templateId?: string
      }

      const existing = await db.offerLetter.findUnique({ where: { id } })
      if (!existing || existing.deletedAt) return createErrorResponse('Not found', 404)

      const now = new Date()
      const statusUpdate = body.status as 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | undefined
      const updateData: Record<string, unknown> = {}

      if (body.content !== undefined) updateData.content = body.content
      if (statusUpdate) {
        updateData.status = statusUpdate
        if (statusUpdate === 'SENT') {
          updateData.emailedAt = now
          updateData.sentBy    = body.sentBy ?? body.performedBy ?? null
        }
        if (statusUpdate === 'ACCEPTED') updateData.acceptedAt = now
        if (statusUpdate === 'REJECTED') updateData.rejectedAt = now
        if (statusUpdate === 'EXPIRED')  updateData.expiredAt  = now
      }

      // Draft edit — candidate fields may be updated before generate is called
      if (!existing.offerRef) {
        if (body.candidateName    !== undefined) updateData.candidateName    = body.candidateName
        if (body.candidateEmail   !== undefined) updateData.candidateEmail   = body.candidateEmail
        if (body.candidateMobile  !== undefined) updateData.candidateMobile  = body.candidateMobile
        if (body.designation      !== undefined) updateData.designation      = body.designation
        if (body.department       !== undefined) updateData.department       = body.department
        if (body.reportingManager !== undefined) updateData.reportingManager = body.reportingManager
        if (body.workLocation     !== undefined) updateData.workLocation     = body.workLocation
        if (body.joiningDate      !== undefined) {
          updateData.joiningDate = body.joiningDate ? new Date(body.joiningDate) : null
        }
        if (body.employmentType !== undefined) {
          updateData.employmentType = body.employmentType as 'PERMANENT' | 'CONTRACT' | 'COMMISSION_BASED' | 'CONSULTANT' | 'INTERN'
        }
        if (body.templateId !== undefined) updateData.templateId = body.templateId || null
      }

      const letter = await db.offerLetter.update({ where: { id }, data: updateData })

      if (statusUpdate && statusUpdate !== existing.status) {
        await db.hrmsAuditLog.create({
          data: {
            module:      'OFFER_LETTER',
            entityId:    id,
            action:      `Status changed to ${statusUpdate}`,
            oldValue:    existing.status,
            newValue:    statusUpdate,
            performedBy: body.performedBy ?? body.sentBy,
          },
        })
      }

      return NextResponse.json({ success: true, data: letter })
    } catch (e) {
      return createErrorResponse(e instanceof Error ? e.message : 'Failed', 500)
    }
  }
)

export const DELETE = withMiddleware({ requireAuth: true, requiredPermission: 'hrms:manage' })(
  async (_req: NextRequest, ctx?: Ctx) => {
    try {
      const id = await getId(ctx)
      if (!id) return createErrorResponse('id required', 400)
      await db.offerLetter.update({ where: { id }, data: { deletedAt: new Date() } })
      return NextResponse.json({ success: true })
    } catch (e) {
      return createErrorResponse(e instanceof Error ? e.message : 'Failed', 500)
    }
  }
)
