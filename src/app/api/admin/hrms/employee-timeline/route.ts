import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'

export const GET = withMiddleware({ requireAuth: true, requiredPermission: 'hrms:view' })(
  async (req: NextRequest) => {
    try {
      const { searchParams } = new URL(req.url)
      const employeeId = searchParams.get('employeeId')
      if (!employeeId) return createErrorResponse('employeeId required', 400)

      const entries = await db.employeeTimeline.findMany({
        where: { employeeId },
        orderBy: { createdAt: 'desc' },
      })

      return NextResponse.json({ success: true, data: entries })
    } catch (e) {
      return createErrorResponse(e instanceof Error ? e.message : 'Failed', 500)
    }
  }
)

export const POST = withMiddleware({ requireAuth: true, requiredPermission: 'hrms:manage' })(
  async (req: NextRequest) => {
    try {
      const body = await req.json() as { employeeId: string; event: string; description?: string; performedBy?: string }
      if (!body.employeeId || !body.event) return createErrorResponse('employeeId and event required', 400)

      const entry = await db.employeeTimeline.create({
        data: {
          employeeId:  body.employeeId,
          event:       body.event,
          description: body.description,
          performedBy: body.performedBy,
        },
      })

      return NextResponse.json({ success: true, data: entry }, { status: 201 })
    } catch (e) {
      return createErrorResponse(e instanceof Error ? e.message : 'Failed', 500)
    }
  }
)
