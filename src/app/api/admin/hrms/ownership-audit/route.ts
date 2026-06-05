import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'

export const GET = withMiddleware({ requireAuth: true, requiredPermission: 'hrms:view' })(
  async (req: NextRequest) => {
    try {
      const { searchParams } = new URL(req.url)
      const clientBusinessId = searchParams.get('clientBusinessId')

      const where = clientBusinessId ? { clientBusinessId } : {}
      const entries = await db.ownershipAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 200,
      })

      const employeeIds = [...new Set([
        ...entries.map((e) => e.previousOwnerId).filter(Boolean),
        ...entries.map((e) => e.newOwnerId).filter(Boolean),
      ])] as string[]

      const clientIds = [...new Set(entries.map((e) => e.clientBusinessId))]

      const [employees, businesses] = await Promise.all([
        db.employee.findMany({ where: { id: { in: employeeIds } }, select: { id: true, name: true, employeeCode: true } }),
        db.business.findMany({ where: { id: { in: clientIds } }, select: { id: true, name: true } }),
      ])

      const empMap  = Object.fromEntries(employees.map((e) => [e.id, e]))
      const bizMap  = Object.fromEntries(businesses.map((b) => [b.id, b]))

      const enriched = entries.map((e) => ({
        ...e,
        previousOwner:  e.previousOwnerId ? empMap[e.previousOwnerId] ?? null : null,
        newOwner:        e.newOwnerId       ? empMap[e.newOwnerId]       ?? null : null,
        clientBusiness:  bizMap[e.clientBusinessId] ?? { id: e.clientBusinessId, name: 'Unknown' },
      }))

      return NextResponse.json({ success: true, data: enriched })
    } catch (e) {
      return createErrorResponse(e instanceof Error ? e.message : 'Failed', 500)
    }
  }
)
