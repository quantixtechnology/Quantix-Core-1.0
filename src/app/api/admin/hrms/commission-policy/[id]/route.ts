import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'

type Ctx = { params?: Promise<Record<string, string | string[]>> }

const getId = async (ctx?: Ctx) => {
  const p = await ctx?.params
  return Array.isArray(p?.id) ? p?.id[0] : p?.id
}

export const PUT = withMiddleware({ requireAuth: true, requiredPermission: 'hrms:manage' })(
  async (req: NextRequest, ctx?: Ctx) => {
    try {
      const id = await getId(ctx)
      if (!id) return createErrorResponse('id required', 400)
      const body = await req.json() as Record<string, unknown>
      const policy = await db.commissionPolicy.update({
        where: { id },
        data: {
          name:          body.name          as string | undefined,
          effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom as string) : undefined,
          effectiveTo:   body.effectiveTo   ? new Date(body.effectiveTo   as string) : undefined,
          tiers:         body.tiers ? JSON.stringify(body.tiers) : undefined,
          isActive:      body.isActive      as boolean | undefined,
          notes:         body.notes         as string | undefined,
        },
      })
      return NextResponse.json({ success: true, data: policy })
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
      await db.commissionPolicy.delete({ where: { id } })
      return NextResponse.json({ success: true })
    } catch (e) {
      return createErrorResponse(e instanceof Error ? e.message : 'Failed', 500)
    }
  }
)
