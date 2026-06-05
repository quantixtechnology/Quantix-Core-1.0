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

      if (body.isDefault) {
        const tpl = await db.offerLetterTemplate.findUnique({ where: { id } })
        if (tpl) {
          await db.offerLetterTemplate.updateMany({ where: { businessId: tpl.businessId, isDefault: true }, data: { isDefault: false } })
        }
      }

      const template = await db.offerLetterTemplate.update({
        where: { id },
        data: {
          name:        body.name        as string | undefined,
          description: body.description as string | undefined,
          content:     body.content     as string | undefined,
          isDefault:   body.isDefault   as boolean | undefined,
          isActive:    body.isActive    as boolean | undefined,
        },
      })
      return NextResponse.json({ success: true, data: template })
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
      await db.offerLetterTemplate.update({ where: { id }, data: { deletedAt: new Date() } })
      return NextResponse.json({ success: true })
    } catch (e) {
      return createErrorResponse(e instanceof Error ? e.message : 'Failed', 500)
    }
  }
)
