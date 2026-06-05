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
      const emp = await db.employee.findUnique({ where: { id } })
      if (!emp || emp.deletedAt) return createErrorResponse('Not found', 404)
      return NextResponse.json({ success: true, data: emp })
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
      const emp = await db.employee.update({
        where: { id },
        data: {
          name:             body.name             as string | undefined,
          email:            body.email            as string | undefined,
          mobile:           body.mobile           as string | undefined,
          designation:      body.designation      as string | undefined,
          department:       body.department       as string | undefined,
          joiningDate:      body.joiningDate ? new Date(body.joiningDate as string) : undefined,
          employmentType:   body.employmentType   as 'PERMANENT' | 'CONTRACT' | 'COMMISSION_BASED' | 'CONSULTANT' | 'INTERN' | undefined,
          reportingManager: body.reportingManager as string | undefined,
          status:           body.status           as 'PROSPECT' | 'OFFERED' | 'JOINED' | 'ACTIVE' | 'RESIGNED' | 'TERMINATED' | undefined,
        },
      })
      return NextResponse.json({ success: true, data: emp })
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
      await db.employee.update({ where: { id }, data: { deletedAt: new Date() } })
      return NextResponse.json({ success: true })
    } catch (e) {
      return createErrorResponse(e instanceof Error ? e.message : 'Failed', 500)
    }
  }
)
