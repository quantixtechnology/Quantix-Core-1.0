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
      const slip = await db.commissionSlip.findUnique({
        where: { id },
        include: { employee: true },
      })
      if (!slip || slip.deletedAt) return createErrorResponse('Not found', 404)
      return NextResponse.json({ success: true, data: slip })
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
      const body = await req.json() as Record<string, unknown>
      const slip = await db.commissionSlip.update({
        where: { id },
        data: {
          adjustments:    body.adjustments    as number | undefined,
          adjustmentNote: body.adjustmentNote as string | undefined,
          notes:          body.notes          as string | undefined,
          status:         body.status         as 'DRAFT' | 'UNDER_REVIEW' | 'APPROVED' | 'PAID' | undefined,
          paidAt:         body.paidAt ? new Date(body.paidAt as string) : undefined,
        },
      })
      return NextResponse.json({ success: true, data: slip })
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
      await db.commissionSlip.update({ where: { id }, data: { deletedAt: new Date() } })
      return NextResponse.json({ success: true })
    } catch (e) {
      return createErrorResponse(e instanceof Error ? e.message : 'Failed', 500)
    }
  }
)
