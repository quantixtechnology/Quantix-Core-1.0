import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'

export const GET = withMiddleware({ requireAuth: true, requiredPermission: 'hrms:view' })(
  async (req: NextRequest) => {
    try {
      const { searchParams } = new URL(req.url)
      const businessId = searchParams.get('businessId') || ''
      const search = searchParams.get('search') || ''
      const status = searchParams.get('status')
      const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
      const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '50'))

      const where = {
        businessId,
        deletedAt: null,
        ...(status ? { status: status as 'ACTIVE' | 'INACTIVE' | 'TERMINATED' } : {}),
        ...(search ? {
          OR: [
            { name: { contains: search } },
            { email: { contains: search } },
            { employeeCode: { contains: search } },
            { designation: { contains: search } },
          ],
        } : {}),
      }

      const [rows, total] = await Promise.all([
        db.employee.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        db.employee.count({ where }),
      ])

      return NextResponse.json({
        success: true,
        data: rows,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      })
    } catch (e) {
      return createErrorResponse(e instanceof Error ? e.message : 'Failed', 500)
    }
  }
)

export const POST = withMiddleware({ requireAuth: true, requiredPermission: 'hrms:manage' })(
  async (req: NextRequest) => {
    try {
      const body = await req.json() as {
        businessId: string
        employeeCode: string
        name: string
        email: string
        mobile?: string
        designation: string
        department?: string
        joiningDate: string
        employmentType?: string
        reportingManager?: string
        status?: string
      }

      if (!body.businessId || !body.name || !body.email || !body.employeeCode || !body.designation) {
        return createErrorResponse('businessId, name, email, employeeCode, designation required', 400)
      }

      const employee = await db.employee.create({
        data: {
          businessId: body.businessId,
          employeeCode: body.employeeCode,
          name: body.name,
          email: body.email,
          mobile: body.mobile,
          designation: body.designation,
          department: body.department,
          joiningDate: new Date(body.joiningDate),
          employmentType: (body.employmentType as 'PERMANENT' | 'CONTRACT' | 'COMMISSION_BASED' | 'CONSULTANT' | 'INTERN') ?? 'PERMANENT',
          reportingManager: body.reportingManager,
          status: (body.status as 'ACTIVE' | 'INACTIVE' | 'TERMINATED') ?? 'ACTIVE',
        },
      })

      return NextResponse.json({ success: true, data: employee }, { status: 201 })
    } catch (e) {
      return createErrorResponse(e instanceof Error ? e.message : 'Failed', 500)
    }
  }
)
