import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'

export const GET = withMiddleware({ requireAuth: true, requiredPermission: 'revenue_ops:view' })(
  async (req: NextRequest) => {
    try {
      const { searchParams } = new URL(req.url)
      const type = searchParams.get('type') // SIGNUP | RENEWAL | ADDON | null = all
      const businessId = searchParams.get('businessId')

      const where: Record<string, unknown> = {}
      if (type) where.assignmentType = type.toUpperCase()
      if (businessId) where.clientBusinessId = businessId

      const entries = await db.ownershipAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 300,
      })

      // Enrich with employee names where not already stored
      const missingEmpIds = [
        ...new Set([
          ...entries.filter((e) => !e.previousOwnerName && e.previousOwnerId).map((e) => e.previousOwnerId!),
          ...entries.filter((e) => !e.newOwnerName && e.newOwnerId).map((e) => e.newOwnerId!),
        ]),
      ]
      const missingBizIds = [
        ...new Set(entries.filter((e) => !e.businessName).map((e) => e.clientBusinessId)),
      ]

      const [employees, businesses] = await Promise.all([
        missingEmpIds.length
          ? db.employee.findMany({ where: { id: { in: missingEmpIds } }, select: { id: true, name: true } })
          : [],
        missingBizIds.length
          ? db.business.findMany({ where: { id: { in: missingBizIds } }, select: { id: true, name: true } })
          : [],
      ])
      const empMap = Object.fromEntries(employees.map((e) => [e.id, e.name]))
      const bizMap = Object.fromEntries(businesses.map((b) => [b.id, b.name]))

      const enriched = entries.map((e) => ({
        ...e,
        businessName: e.businessName || bizMap[e.clientBusinessId] || e.clientBusinessId,
        previousOwnerName: e.previousOwnerName || (e.previousOwnerId ? empMap[e.previousOwnerId] || e.previousOwnerId : null),
        newOwnerName: e.newOwnerName || (e.newOwnerId ? empMap[e.newOwnerId] || e.newOwnerId : null),
      }))

      return NextResponse.json({ success: true, data: enriched })
    } catch (e) {
      return createErrorResponse(e instanceof Error ? e.message : 'Failed', 500)
    }
  }
)
