import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'

const MERGE_TAGS: Record<string, string> = {
  CandidateName: 'candidateName',
  Designation: 'designation',
  JoiningDate: 'joiningDate',
  ReportingManager: 'reportingManager',
  WorkLocation: 'workLocation',
  Department: 'department',
  EmploymentType: 'employmentType',
}

function renderTemplate(content: string, data: Record<string, string>): string {
  return content.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] ?? `{{${key}}}`)
}

export const GET = withMiddleware({ requireAuth: true, requiredPermission: 'hrms:view' })(
  async (req: NextRequest) => {
    try {
      const { searchParams } = new URL(req.url)
      const businessId = searchParams.get('businessId') || ''
      const status     = searchParams.get('status')
      const page       = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
      const limit      = Math.min(100, parseInt(searchParams.get('limit') ?? '20'))

      const where = {
        businessId,
        deletedAt: null as null,
        ...(status ? { status: status as 'DRAFT' | 'SENT' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' } : {}),
      }

      const [rows, total] = await Promise.all([
        db.offerLetter.findMany({
          where,
          include: { employee: { select: { id: true, name: true, employeeCode: true } } },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        db.offerLetter.count({ where }),
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
        templateId?: string
        employeeId?: string
        candidateName: string
        designation: string
        joiningDate?: string
        department?: string
        reportingManager?: string
        workLocation?: string
        employmentType?: string
        createdBy?: string
      }

      if (!body.businessId || !body.candidateName || !body.designation) {
        return createErrorResponse('businessId, candidateName, designation required', 400)
      }

      // Render template if provided
      let content = ''
      if (body.templateId) {
        const tpl = await db.offerLetterTemplate.findUnique({ where: { id: body.templateId } })
        if (tpl) {
          const mergeData = Object.fromEntries(
            Object.entries(MERGE_TAGS).map(([tag, field]) => [
              tag,
              (body[field as keyof typeof body] as string | undefined) ?? '',
            ])
          )
          mergeData.JoiningDate = body.joiningDate ? new Date(body.joiningDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : ''
          content = renderTemplate(tpl.content, mergeData)
        }
      }

      const letter = await db.offerLetter.create({
        data: {
          businessId:      body.businessId,
          templateId:      body.templateId,
          employeeId:      body.employeeId,
          candidateName:   body.candidateName,
          designation:     body.designation,
          joiningDate:     body.joiningDate ? new Date(body.joiningDate) : null,
          department:      body.department,
          reportingManager: body.reportingManager,
          workLocation:    body.workLocation,
          employmentType:  (body.employmentType as 'PERMANENT' | 'CONTRACT' | 'COMMISSION_BASED' | 'CONSULTANT' | 'INTERN') ?? 'PERMANENT',
          content,
          createdBy:       body.createdBy,
        },
      })

      return NextResponse.json({ success: true, data: letter }, { status: 201 })
    } catch (e) {
      return createErrorResponse(e instanceof Error ? e.message : 'Failed', 500)
    }
  }
)
