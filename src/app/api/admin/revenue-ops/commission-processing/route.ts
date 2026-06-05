import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'

export const GET = withMiddleware({ requireAuth: true, requiredPermission: 'revenue_ops:view' })(
  async (req: NextRequest) => {
    try {
      const { searchParams } = new URL(req.url)
      const status = searchParams.get('status')
      const employeeId = searchParams.get('employeeId')

      const where = {
        deletedAt: null as null,
        ...(status ? { status: status as 'DRAFT' | 'UNDER_REVIEW' | 'APPROVED' | 'PAID' } : {}),
        ...(employeeId ? { employeeId } : {}),
      }

      const slips = await db.commissionSlip.findMany({
        where,
        include: { employee: { select: { id: true, name: true, employeeCode: true, designation: true } } },
        orderBy: { createdAt: 'desc' },
      })

      return NextResponse.json({ success: true, data: slips })
    } catch (e) {
      return createErrorResponse(e instanceof Error ? e.message : 'Failed', 500)
    }
  }
)
