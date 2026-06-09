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
  if (type === 'addon') return 'ADDON'
  return type.toUpperCase()
}

// ─── GET — list assignments ───────────────────────────────────────────────────
export const GET = withMiddleware({ requireAuth: true, requiredPermission: 'revenue_ops:view' })(
  async (req: AuthenticatedRequest, ctx?: Ctx) => {
    try {
      const p = await ctx?.params
      const type = (Array.isArray(p?.type) ? p?.type[0] : p?.type) as string
      const repo = getRepo(type)
      if (!repo) return createErrorResponse('Invalid ownership type', 400)

      const { searchParams } = new URL(req.url)
      const search = searchParams.get('search') || ''
      const status = searchParams.get('status') || ''

      const where: Record<string, unknown> = {}
      if (status && status !== 'all') where.status = status
      if (search) where.businessName = { contains: search }

      const records = await repo.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      })

      return NextResponse.json({ success: true, data: records })
    } catch (e) {
      return createErrorResponse(e instanceof Error ? e.message : 'Failed', 500)
    }
  }
)

// ─── POST — create assignment ─────────────────────────────────────────────────
export const POST = withMiddleware({ requireAuth: true, requiredPermission: 'revenue_ops:manage' })(
  async (req: AuthenticatedRequest, ctx?: Ctx) => {
    try {
      const p = await ctx?.params
      const type = (Array.isArray(p?.type) ? p?.type[0] : p?.type) as string
      const repo = getRepo(type)
      if (!repo) return createErrorResponse('Invalid ownership type', 400)

      const body = await req.json() as {
        businessId: string
        employeeId: string
        effectiveDate: string
        notes?: string
      }

      if (!body.businessId || !body.employeeId || !body.effectiveDate) {
        return createErrorResponse('businessId, employeeId, and effectiveDate are required', 400)
      }

      // Prevent duplicate active assignment
      const existing = await repo.findFirst({
        where: { businessId: body.businessId, status: 'ACTIVE' },
      })
      if (existing) {
        return createErrorResponse(
          `This business already has an active ${type} owner (${existing.employeeName}). Use Reassign to change ownership.`,
          409
        )
      }

      // Enrich with business + employee names
      const [business, employee] = await Promise.all([
        db.business.findUnique({ where: { id: body.businessId }, select: { id: true, name: true } }),
        db.employee.findUnique({ where: { id: body.employeeId }, select: { id: true, name: true, employeeCode: true, designation: true } }),
      ])
      if (!business) return createErrorResponse('Business not found', 404)
      if (!employee) return createErrorResponse('Employee not found', 404)

      const record = await repo.create({
        data: {
          businessId: body.businessId,
          businessName: business.name,
          employeeId: body.employeeId,
          employeeName: employee.name,
          employeeCode: employee.employeeCode,
          designation: employee.designation,
          effectiveDate: new Date(body.effectiveDate),
          notes: body.notes || null,
          status: 'ACTIVE',
          assignedById: req.user?.id,
          assignedByName: req.user?.name,
        },
      })

      await db.ownershipAuditLog.create({
        data: {
          clientBusinessId: body.businessId,
          assignmentType: auditType(type),
          action: 'CREATED',
          newOwnerId: body.employeeId,
          newOwnerName: employee.name,
          businessName: business.name,
          changedBy: req.user?.name,
          changedById: req.user?.id,
          remarks: body.notes,
        },
      })

      return NextResponse.json({ success: true, data: record }, { status: 201 })
    } catch (e) {
      return createErrorResponse(e instanceof Error ? e.message : 'Failed', 500)
    }
  }
)
