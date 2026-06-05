import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'

type Ctx = { params?: Promise<Record<string, string | string[]>> }

const getId = async (ctx?: Ctx) => {
  const p = await ctx?.params
  return Array.isArray(p?.id) ? p?.id[0] : p?.id
}

export const PUT = withMiddleware({ requireAuth: true, requiredPermission: 'revenue_ops:manage' })(
  async (req: NextRequest, ctx?: Ctx) => {
    try {
      const id = await getId(ctx)
      if (!id) return createErrorResponse('id required', 400)

      const body = await req.json() as {
        status?: string
        approvedBy?: string
        notes?: string
        adjustments?: number
        adjustmentNote?: string
        paidAt?: string
      }

      const now = new Date()
      const updateData: Record<string, unknown> = {}

      if (body.status) updateData.status = body.status
      if (body.notes !== undefined) updateData.notes = body.notes
      if (body.approvedBy !== undefined) updateData.approvedBy = body.approvedBy
      if (body.adjustments !== undefined) updateData.adjustments = body.adjustments
      if (body.adjustmentNote !== undefined) updateData.adjustmentNote = body.adjustmentNote

      if (body.status === 'APPROVED') updateData.approvedAt = now
      if (body.status === 'PAID') updateData.paidAt = body.paidAt ? new Date(body.paidAt) : now

      const slip = await db.commissionSlip.update({
        where: { id },
        data: updateData,
        include: { employee: { select: { id: true, name: true, employeeCode: true, designation: true } } },
      })

      await db.hrmsAuditLog.create({
        data: {
          module:      'COMMISSION_PROCESSING',
          entityId:    id,
          action:      body.status ? `Status changed to ${body.status}` : 'Updated',
          performedBy: body.approvedBy,
        },
      })

      return NextResponse.json({ success: true, data: slip })
    } catch (e) {
      return createErrorResponse(e instanceof Error ? e.message : 'Failed', 500)
    }
  }
)
