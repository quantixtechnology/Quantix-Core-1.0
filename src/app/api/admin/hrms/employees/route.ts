import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'

async function generateEmployeeId(joiningDate: string): Promise<{ employeeCode: string; internalSequence: number }> {
  const year = new Date(joiningDate).getFullYear()
  const existing = await db.employee.findMany({
    where: { employeeCode: { startsWith: `QT-${year}-` } },
    select: { employeeCode: true, internalSequence: true },
  })
  const maxSeq = existing.reduce((max, e) => {
    const parts = e.employeeCode.split('-')
    const seq = parseInt(parts[2] ?? '0', 10)
    return isNaN(seq) ? max : Math.max(max, seq)
  }, 0)
  const next = maxSeq + 1
  return { employeeCode: `QT-${year}-${String(next).padStart(3, '0')}`, internalSequence: next }
}

export const GET = withMiddleware({ requireAuth: true, requiredPermission: 'hrms:view' })(
  async (req: NextRequest) => {
    try {
      const { searchParams } = new URL(req.url)
      const search = searchParams.get('search') || ''
      const status = searchParams.get('status')
      const page  = Math.max(1, parseInt(searchParams.get('page')  ?? '1'))
      const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '50'))

      const where = {
        deletedAt: null,
        ...(status ? { status: status as 'PROSPECT' | 'OFFERED' | 'JOINED' | 'ACTIVE' | 'RESIGNED' | 'TERMINATED' } : {}),
        ...(search ? {
          OR: [
            { name:         { contains: search } },
            { email:        { contains: search } },
            { employeeCode: { contains: search } },
            { designation:  { contains: search } },
          ],
        } : {}),
      }

      const [rows, total] = await Promise.all([
        db.employee.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
        db.employee.count({ where }),
      ])

      return NextResponse.json({ success: true, data: rows, pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
    } catch (e) {
      return createErrorResponse(e instanceof Error ? e.message : 'Failed', 500)
    }
  }
)

export const POST = withMiddleware({ requireAuth: true, requiredPermission: 'hrms:manage' })(
  async (req: NextRequest) => {
    try {
      const body = await req.json() as {
        name: string
        email: string
        mobile?: string
        designation: string
        department?: string
        joiningDate: string
        employmentType?: string
        payrollType?: string
        reportingManager?: string
        status?: string
        createdBy?: string
      }

      if (!body.name || !body.email || !body.designation || !body.joiningDate) {
        return createErrorResponse('name, email, designation, joiningDate required', 400)
      }

      const { employeeCode, internalSequence } = await generateEmployeeId(body.joiningDate)

      const employee = await db.employee.create({
        data: {
          employeeCode,
          internalSequence,
          name:             body.name,
          email:            body.email,
          mobile:           body.mobile,
          designation:      body.designation,
          department:       body.department,
          joiningDate:      new Date(body.joiningDate),
          employmentType:   (body.employmentType as 'PERMANENT' | 'CONTRACT' | 'COMMISSION_BASED' | 'CONSULTANT' | 'INTERN') ?? 'PERMANENT',
          payrollType:      body.payrollType ? (body.payrollType as 'SALARY' | 'COMMISSION' | 'HYBRID') : undefined,
          reportingManager: body.reportingManager,
          status:           (body.status as 'PROSPECT' | 'OFFERED' | 'JOINED' | 'ACTIVE' | 'RESIGNED' | 'TERMINATED') ?? 'PROSPECT',
        },
      })

      await db.employeeTimeline.create({
        data: {
          employeeId:  employee.id,
          event:       'Employee Created',
          description: `${employee.name} (${employeeCode}) added as ${employee.designation}`,
          performedBy: body.createdBy,
        },
      })

      return NextResponse.json({ success: true, data: employee }, { status: 201 })
    } catch (e) {
      return createErrorResponse(e instanceof Error ? e.message : 'Failed', 500)
    }
  }
)
