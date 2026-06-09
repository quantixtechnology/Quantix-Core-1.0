import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'

type Ctx = { params?: Promise<Record<string, string | string[]>> }

interface AuthenticatedRequest extends NextRequest {
  user?: { id: string; name: string; email: string; role: string }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getRepo(type: string): any {
  if (type === 'signup') return db.signupOwnership
  if (type === 'renewal') return db.renewalOwnership
  if (type === 'addon') return db.addonOwnership
  return null
}

function auditType(type: string) {
  if (type === 'signup') return 'SIGNUP'
  if (type === 'renewal') return 'RENEWAL'
  return 'ADDON'
}

// ─── PATCH — edit | deactivate | reassign ─────────────────────────────────────
export const PATCH = withMiddleware({ requireAuth: true, requiredPermission: 'revenue_ops:manage' })(
  async (req: AuthenticatedRequest, ctx?: Ctx) => {
    try {
      const p = await ctx?.params
      const type = (Array.isArray(p?.type) ? p?.type[0] : p?.type) as string
      const id   = (Array.isArray(p?.id)   ? p?.id[0]   : p?.id)   as string
      const repo = getRepo(type)
      if (!repo) return createErrorResponse('Invalid ownership type', 400)
      if (!id)   return createErrorResponse('id required', 400)

      const body = await req.json() as {
        action: 'edit' | 'deactivate' | 'reassign'
        notes?: string
        effectiveDate?: string
        // reassign only
        newEmployeeId?: string
        newEffectiveDate?: string
        newNotes?: string
      }

      const current = await repo.findUnique({ where: { id } })
      if (!current) return createErrorResponse('Record not found', 404)

      if (body.action === 'deactivate') {
        const updated = await repo.update({
          where: { id },
          data: {
            status: 'INACTIVE',
            deactivatedAt: new Date(),
            deactivatedBy: req.user?.name,
          },
        })
        await db.ownershipAuditLog.create({
          data: {
            clientBusinessId: current.businessId,
            assignmentType: auditType(type),
            action: 'DEACTIVATED',
            previousOwnerId: current.employeeId,
            previousOwnerName: current.employeeName,
            businessName: current.businessName,
            changedBy: req.user?.name,
            changedById: req.user?.id,
          },
        })
        return NextResponse.json({ success: true, data: updated })
      }

      if (body.action === 'edit') {
        const data: Record<string, unknown> = {}
        if ('notes' in body) data.notes = body.notes || null
        if (body.effectiveDate) data.effectiveDate = new Date(body.effectiveDate)
        const updated = await repo.update({ where: { id }, data })
        await db.ownershipAuditLog.create({
          data: {
            clientBusinessId: current.businessId,
            assignmentType: auditType(type),
            action: 'UPDATED',
            previousOwnerId: current.employeeId,
            previousOwnerName: current.employeeName,
            newOwnerId: current.employeeId,
            newOwnerName: current.employeeName,
            businessName: current.businessName,
            changedBy: req.user?.name,
            changedById: req.user?.id,
            remarks: body.notes,
          },
        })
        return NextResponse.json({ success: true, data: updated })
      }

      if (body.action === 'reassign') {
        if (!body.newEmployeeId || !body.newEffectiveDate) {
          return createErrorResponse('newEmployeeId and newEffectiveDate required for reassign', 400)
        }

        const employee = await db.employee.findUnique({
          where: { id: body.newEmployeeId },
          select: { id: true, name: true, employeeCode: true, designation: true },
        })
        if (!employee) return createErrorResponse('Employee not found', 404)

        // Deactivate current record
        await repo.update({
          where: { id },
          data: { status: 'INACTIVE', deactivatedAt: new Date(), deactivatedBy: req.user?.name },
        })

        // Create new active record
        const newRecord = await repo.create({
          data: {
            businessId: current.businessId,
            businessName: current.businessName,
            employeeId: employee.id,
            employeeName: employee.name,
            employeeCode: employee.employeeCode,
            designation: employee.designation,
            effectiveDate: new Date(body.newEffectiveDate),
            notes: body.newNotes || null,
            status: 'ACTIVE',
            assignedById: req.user?.id,
            assignedByName: req.user?.name,
          },
        })

        await db.ownershipAuditLog.create({
          data: {
            clientBusinessId: current.businessId,
            assignmentType: auditType(type),
            action: 'REASSIGNED',
            previousOwnerId: current.employeeId,
            previousOwnerName: current.employeeName,
            newOwnerId: employee.id,
            newOwnerName: employee.name,
            businessName: current.businessName,
            changedBy: req.user?.name,
            changedById: req.user?.id,
            remarks: body.newNotes,
          },
        })

        return NextResponse.json({ success: true, data: newRecord })
      }

      return createErrorResponse('Invalid action', 400)
    } catch (e) {
      return createErrorResponse(e instanceof Error ? e.message : 'Failed', 500)
    }
  }
)
