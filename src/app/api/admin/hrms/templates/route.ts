import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'

export const GET = withMiddleware({ requireAuth: true, requiredPermission: 'hrms:view' })(
  async (req: NextRequest) => {
    try {
      const { searchParams } = new URL(req.url)
      const businessId = searchParams.get('businessId') || ''
      const templates = await db.offerLetterTemplate.findMany({
        where: { businessId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      })
      return NextResponse.json({ success: true, data: templates })
    } catch (e) {
      return createErrorResponse(e instanceof Error ? e.message : 'Failed', 500)
    }
  }
)

export const POST = withMiddleware({ requireAuth: true, requiredPermission: 'hrms:manage' })(
  async (req: NextRequest) => {
    try {
      const body = await req.json() as {
        businessId: string
        name: string
        description?: string
        content: string
        isDefault?: boolean
        createdBy?: string
      }

      if (!body.businessId || !body.name || !body.content) {
        return createErrorResponse('businessId, name, content required', 400)
      }

      // If marking as default, un-default the others
      if (body.isDefault) {
        await db.offerLetterTemplate.updateMany({ where: { businessId: body.businessId, isDefault: true }, data: { isDefault: false } })
      }

      const template = await db.offerLetterTemplate.create({
        data: {
          businessId:  body.businessId,
          name:        body.name,
          description: body.description,
          content:     body.content,
          isDefault:   body.isDefault ?? false,
          createdBy:   body.createdBy,
        },
      })
      return NextResponse.json({ success: true, data: template }, { status: 201 })
    } catch (e) {
      return createErrorResponse(e instanceof Error ? e.message : 'Failed', 500)
    }
  }
)
