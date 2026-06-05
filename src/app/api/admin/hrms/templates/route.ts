import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'

export const GET = withMiddleware({ requireAuth: true, requiredPermission: 'hrms:view' })(
  async () => {
    try {
      const templates = await db.offerLetterTemplate.findMany({
        where: { deletedAt: null },
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
        name: string
        description?: string
        content: string
        isDefault?: boolean
        isActive?: boolean
        createdBy?: string
      }

      if (!body.name || !body.content) {
        return createErrorResponse('name and content required', 400)
      }

      if (body.isDefault) {
        await db.offerLetterTemplate.updateMany({ where: { isDefault: true }, data: { isDefault: false } })
      }

      const template = await db.offerLetterTemplate.create({
        data: {
          name:        body.name,
          description: body.description,
          content:     body.content,
          isDefault:   body.isDefault ?? false,
          isActive:    body.isActive  ?? true,
          createdBy:   body.createdBy,
        },
      })
      return NextResponse.json({ success: true, data: template }, { status: 201 })
    } catch (e) {
      return createErrorResponse(e instanceof Error ? e.message : 'Failed', 500)
    }
  }
)
