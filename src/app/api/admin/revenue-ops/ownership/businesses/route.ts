import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'

export const GET = withMiddleware({ requireAuth: true, requiredPermission: 'revenue_ops:view' })(
  async (req: NextRequest) => {
    try {
      const { searchParams } = new URL(req.url)
      const search = searchParams.get('search') || ''

      const businesses = await db.business.findMany({
        where: {
          status: { in: ['ACTIVE', 'ONBOARDING'] },
          ...(search ? { name: { contains: search } } : {}),
        },
        select: { id: true, name: true, status: true, businessType: true },
        orderBy: { name: 'asc' },
        take: 200,
      })

      return NextResponse.json({ success: true, data: businesses })
    } catch (e) {
      return createErrorResponse(e instanceof Error ? e.message : 'Failed', 500)
    }
  }
)
