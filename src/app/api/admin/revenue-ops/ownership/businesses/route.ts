import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'

interface AuthenticatedRequest extends NextRequest {
  user?: { id: string; name: string; email: string; role: string; businessId?: string; isPlatformAdmin?: boolean }
}

export const GET = withMiddleware({ requireAuth: true, requiredPermission: 'revenue_ops:view' })(
  async (req: AuthenticatedRequest) => {
    try {
      const { searchParams } = new URL(req.url)
      const search = searchParams.get('search') || ''

      const statusFilter = ['ACTIVE', 'ONBOARDING']
      console.log('[ownership/businesses] query filter: status IN', statusFilter, '| search:', search || '(none)')
      console.log('[ownership/businesses] caller:', req.user?.role, '| isPlatformAdmin:', req.user?.isPlatformAdmin, '| businessId:', req.user?.businessId ?? 'none')

      const businesses = await db.business.findMany({
        where: {
          status: { in: ['ACTIVE', 'ONBOARDING'] },
          ...(search ? { name: { contains: search } } : {}),
        },
        select: { id: true, name: true, status: true, businessType: true },
        orderBy: { name: 'asc' },
        take: 200,
      })

      console.log('[ownership/businesses] result count:', businesses.length, '| status filter: ACTIVE,ONBOARDING | NO tenant filter applied')

      return NextResponse.json({ success: true, data: businesses, _meta: { count: businesses.length, filter: 'ACTIVE+ONBOARDING' } })
    } catch (e) {
      console.error('[ownership/businesses] error:', e)
      return createErrorResponse(e instanceof Error ? e.message : 'Failed', 500)
    }
  }
)
