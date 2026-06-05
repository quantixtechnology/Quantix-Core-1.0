import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'

export const GET = withMiddleware({ requireAuth: true, requiredPermission: 'hrms:view' })(
  async (req: NextRequest) => {
    try {
      const { searchParams } = new URL(req.url)
      const search = searchParams.get('search') || ''

      const assignments = await db.ownershipAssignment.findMany({ orderBy: { createdAt: 'desc' } })

      const clientIds = [...new Set(assignments.map((a) => a.clientBusinessId))]
      const employeeIds = [...new Set([
        ...assignments.map((a) => a.signupOwnerId).filter(Boolean),
        ...assignments.map((a) => a.renewalOwnerId).filter(Boolean),
        ...assignments.map((a) => a.addonOwnerId).filter(Boolean),
      ])] as string[]

      const [businesses, employees] = await Promise.all([
        db.business.findMany({ where: { id: { in: clientIds } }, select: { id: true, name: true, status: true } }),
        db.employee.findMany({ where: { id: { in: employeeIds } }, select: { id: true, name: true, employeeCode: true, designation: true } }),
      ])

      const bizMap = Object.fromEntries(businesses.map((b) => [b.id, b]))
      const empMap = Object.fromEntries(employees.map((e) => [e.id, e]))

      const enriched = assignments
        .map((a) => ({
          ...a,
          clientBusiness: bizMap[a.clientBusinessId] ?? { id: a.clientBusinessId, name: 'Unknown', status: '' },
          signupOwner:    a.signupOwnerId  ? empMap[a.signupOwnerId]  ?? null : null,
          renewalOwner:   a.renewalOwnerId ? empMap[a.renewalOwnerId] ?? null : null,
          addonOwner:     a.addonOwnerId   ? empMap[a.addonOwnerId]   ?? null : null,
        }))
        .filter((a) => !search || a.clientBusiness.name.toLowerCase().includes(search.toLowerCase()))

      return NextResponse.json({ success: true, data: enriched })
    } catch (e) {
      return createErrorResponse(e instanceof Error ? e.message : 'Failed', 500)
    }
  }
)

export const POST = withMiddleware({ requireAuth: true, requiredPermission: 'hrms:manage' })(
  async (req: NextRequest) => {
    try {
      const body = await req.json() as {
        clientBusinessId: string
        signupOwnerId?: string
        renewalOwnerId?: string
        addonOwnerId?: string
        assignedBy?: string
        notes?: string
      }

      if (!body.clientBusinessId) {
        return createErrorResponse('clientBusinessId required', 400)
      }

      const assignment = await db.ownershipAssignment.upsert({
        where: { clientBusinessId: body.clientBusinessId },
        update: {
          signupOwnerId:  body.signupOwnerId  || null,
          renewalOwnerId: body.renewalOwnerId || null,
          addonOwnerId:   body.addonOwnerId   || null,
          assignedBy:     body.assignedBy,
          notes:          body.notes,
        },
        create: {
          clientBusinessId: body.clientBusinessId,
          signupOwnerId:    body.signupOwnerId  || null,
          renewalOwnerId:   body.renewalOwnerId || null,
          addonOwnerId:     body.addonOwnerId   || null,
          assignedBy:       body.assignedBy,
          notes:            body.notes,
        },
      })

      return NextResponse.json({ success: true, data: assignment }, { status: 201 })
    } catch (e) {
      return createErrorResponse(e instanceof Error ? e.message : 'Failed', 500)
    }
  }
)
