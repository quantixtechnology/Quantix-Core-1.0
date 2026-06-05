import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'

type Ctx = { params?: Promise<Record<string, string | string[]>> }

const getId = async (ctx?: Ctx) => {
  const p = await ctx?.params
  return Array.isArray(p?.id) ? p?.id[0] : p?.id
}

const TIMELINE_EVENTS: Record<string, string> = {
  PROSPECT:   'Status changed to Prospect',
  OFFERED:    'Offer Letter Sent — Status: Offered',
  JOINED:     'Offer Letter Accepted — Status: Joined',
  ACTIVE:     'Activated',
  RESIGNED:   'Resigned',
  TERMINATED: 'Terminated',
}

export const GET = withMiddleware({ requireAuth: true, requiredPermission: 'hrms:view' })(
  async (_req: NextRequest, ctx?: Ctx) => {
    try {
      const id = await getId(ctx)
      if (!id) return createErrorResponse('id required', 400)
      const emp = await db.employee.findUnique({ where: { id } })
      if (!emp || emp.deletedAt) return createErrorResponse('Not found', 404)
      return NextResponse.json({ success: true, data: emp })
    } catch (e) {
      return createErrorResponse(e instanceof Error ? e.message : 'Failed', 500)
    }
  }
)

export const PUT = withMiddleware({ requireAuth: true, requiredPermission: 'hrms:manage' })(
  async (req: NextRequest, ctx?: Ctx) => {
    try {
      const id = await getId(ctx)
      if (!id) return createErrorResponse('id required', 400)
      const body = await req.json() as Record<string, unknown>

      const existing = await db.employee.findUnique({ where: { id } })
      if (!existing || existing.deletedAt) return createErrorResponse('Not found', 404)

      const emp = await db.employee.update({
        where: { id },
        data: {
          name:             body.name             as string | undefined,
          email:            body.email            as string | undefined,
          mobile:           body.mobile           as string | undefined,
          designation:      body.designation      as string | undefined,
          department:       body.department       as string | undefined,
          joiningDate:      body.joiningDate ? new Date(body.joiningDate as string) : undefined,
          employmentType:   body.employmentType   as 'PERMANENT' | 'CONTRACT' | 'COMMISSION_BASED' | 'CONSULTANT' | 'INTERN' | undefined,
          payrollType:      body.payrollType      as 'SALARY' | 'COMMISSION' | 'HYBRID' | undefined,
          reportingManager: body.reportingManager as string | undefined,
          status:           body.status           as 'PROSPECT' | 'OFFERED' | 'JOINED' | 'ACTIVE' | 'RESIGNED' | 'TERMINATED' | undefined,
        },
      })

      const performedBy = body.updatedBy as string | undefined
      const auditEntries: { module: string; entityId: string; action: string; oldValue?: string; newValue?: string; performedBy?: string }[] = []
      const timelineEntries: { employeeId: string; event: string; description?: string; performedBy?: string }[] = []

      const tracked: { field: string; label: string; old: unknown; new: unknown }[] = [
        { field: 'status',           label: 'Status',            old: existing.status,           new: body.status },
        { field: 'payrollType',      label: 'Payroll Type',      old: existing.payrollType,      new: body.payrollType },
        { field: 'designation',      label: 'Designation',       old: existing.designation,      new: body.designation },
        { field: 'reportingManager', label: 'Reporting Manager', old: existing.reportingManager, new: body.reportingManager },
      ]

      for (const t of tracked) {
        if (t.new !== undefined && t.new !== null && t.new !== t.old) {
          auditEntries.push({
            module:      'EMPLOYEE',
            entityId:    id,
            action:      `${t.label} changed`,
            oldValue:    String(t.old ?? ''),
            newValue:    String(t.new),
            performedBy,
          })

          if (t.field === 'status') {
            const event = TIMELINE_EVENTS[String(t.new)] ?? `Status changed to ${t.new}`
            timelineEntries.push({ employeeId: id, event, description: `Changed from ${t.old} to ${t.new}`, performedBy })
          } else if (t.field === 'payrollType') {
            timelineEntries.push({ employeeId: id, event: 'Payroll Type Updated', description: `Changed from ${t.old ?? 'Not set'} to ${t.new}`, performedBy })
          } else if (t.field === 'designation') {
            timelineEntries.push({ employeeId: id, event: 'Designation Updated', description: `Changed from ${t.old} to ${t.new}`, performedBy })
          } else if (t.field === 'reportingManager') {
            timelineEntries.push({ employeeId: id, event: 'Reporting Manager Updated', description: `Changed from ${t.old ?? 'None'} to ${t.new}`, performedBy })
          }
        }
      }

      if (auditEntries.length) await db.hrmsAuditLog.createMany({ data: auditEntries })
      for (const t of timelineEntries) await db.employeeTimeline.create({ data: t })

      return NextResponse.json({ success: true, data: emp })
    } catch (e) {
      return createErrorResponse(e instanceof Error ? e.message : 'Failed', 500)
    }
  }
)

export const DELETE = withMiddleware({ requireAuth: true, requiredPermission: 'hrms:manage' })(
  async (_req: NextRequest, ctx?: Ctx) => {
    try {
      const id = await getId(ctx)
      if (!id) return createErrorResponse('id required', 400)
      await db.employee.update({ where: { id }, data: { deletedAt: new Date() } })
      return NextResponse.json({ success: true })
    } catch (e) {
      return createErrorResponse(e instanceof Error ? e.message : 'Failed', 500)
    }
  }
)
