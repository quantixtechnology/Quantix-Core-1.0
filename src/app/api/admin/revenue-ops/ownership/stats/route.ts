import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'

export const GET = withMiddleware({ requireAuth: true, requiredPermission: 'revenue_ops:view' })(
  async (_req: NextRequest) => {
    try {
      const [sActive, rActive, aActive, sPending, rPending, aPending, sTotal, rTotal, aTotal] =
        await Promise.all([
          db.signupOwnership.findMany({ where: { status: 'ACTIVE' }, select: { businessId: true, employeeId: true } }),
          db.renewalOwnership.findMany({ where: { status: 'ACTIVE' }, select: { businessId: true, employeeId: true } }),
          db.addonOwnership.findMany({ where: { status: 'ACTIVE' }, select: { businessId: true, employeeId: true } }),
          db.signupOwnership.count({ where: { status: 'PENDING_REASSIGN' } }),
          db.renewalOwnership.count({ where: { status: 'PENDING_REASSIGN' } }),
          db.addonOwnership.count({ where: { status: 'PENDING_REASSIGN' } }),
          db.signupOwnership.count(),
          db.renewalOwnership.count(),
          db.addonOwnership.count(),
        ])

      const allActive = [...sActive, ...rActive, ...aActive]
      const totalAssignedBusinesses = new Set(allActive.map((x) => x.businessId)).size
      const activeOwners = new Set(allActive.map((x) => x.employeeId)).size
      const pendingReassignments = sPending + rPending + aPending
      const totalRecords = sTotal + rTotal + aTotal

      return NextResponse.json({
        success: true,
        data: { totalAssignedBusinesses, activeOwners, pendingReassignments, totalRecords },
      })
    } catch (e) {
      return createErrorResponse(e instanceof Error ? e.message : 'Failed', 500)
    }
  }
)
