import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'

export const GET = withMiddleware({ requireAuth: true, requiredPermission: 'hrms:view' })(
  async () => {
    try {
      const policies = await db.commissionPolicy.findMany({ orderBy: { effectiveFrom: 'desc' } })
      return NextResponse.json({ success: true, data: policies })
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
        effectiveFrom: string
        effectiveTo?: string
        tiers: unknown[]
        isActive?: boolean
        notes?: string
        createdBy?: string
      }

      if (!body.name || !body.effectiveFrom) {
        return createErrorResponse('name and effectiveFrom required', 400)
      }

      const policy = await db.commissionPolicy.create({
        data: {
          name:          body.name,
          effectiveFrom: new Date(body.effectiveFrom),
          effectiveTo:   body.effectiveTo ? new Date(body.effectiveTo) : null,
          tiers:         JSON.stringify(body.tiers ?? []),
          isActive:      body.isActive ?? true,
          notes:         body.notes,
          createdBy:     body.createdBy,
        },
      })

      return NextResponse.json({ success: true, data: policy }, { status: 201 })
    } catch (e) {
      return createErrorResponse(e instanceof Error ? e.message : 'Failed', 500)
    }
  }
)
