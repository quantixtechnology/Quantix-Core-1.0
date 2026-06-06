import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'

function renderTemplate(content: string, data: Record<string, string>): string {
  return content.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] ?? `{{${key}}}`)
}

export const GET = withMiddleware({ requireAuth: true, requiredPermission: 'hrms:view' })(
  async (req: NextRequest) => {
    try {
      const { searchParams } = new URL(req.url)
      const status = searchParams.get('status')
      const page   = Math.max(1, parseInt(searchParams.get('page')  ?? '1'))
      const limit  = Math.min(100, parseInt(searchParams.get('limit') ?? '20'))

      const where = {
        deletedAt: null as null,
        ...(status ? { status: status as 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' } : {}),
      }

      const [rows, total] = await Promise.all([
        db.offerLetter.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        db.offerLetter.count({ where }),
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
        templateId?: string
        candidateName: string
        candidateEmail?: string
        candidateMobile?: string
        designation: string
        joiningDate?: string
        department?: string
        reportingManager?: string
        workLocation?: string
        employmentType?: string
        createdBy?: string
      }

      if (!body.candidateName || !body.designation) {
        return createErrorResponse('candidateName and designation required', 400)
      }

      let content = ''
      if (body.templateId) {
        const tpl = await db.offerLetterTemplate.findUnique({ where: { id: body.templateId } })
        if (tpl) {
          const mergeData: Record<string, string> = {
            CandidateName:    body.candidateName ?? '',
            Designation:      body.designation ?? '',
            JoiningDate:      body.joiningDate
              ? new Date(body.joiningDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
              : '',
            ReportingManager: body.reportingManager ?? '',
            WorkLocation:     body.workLocation ?? '',
            Department:       body.department ?? '',
            EmploymentType:   body.employmentType ?? '',
          }
          content = renderTemplate(tpl.content, mergeData)
        }
      }

      const year = new Date().getFullYear().toString()
      const seq = await db.offerLetterSequence.upsert({
        where: { yearKey: year },
        update: { nextVal: { increment: 1 } },
        create: { yearKey: year, nextVal: 2 },
      })
      const offerRef = `QT/HR/${year}/${String(seq.nextVal - 1).padStart(5, '0')}`

      const letter = await db.offerLetter.create({
        data: {
          offerRef,
          templateId:       body.templateId,
          candidateName:    body.candidateName,
          candidateEmail:   body.candidateEmail,
          candidateMobile:  body.candidateMobile,
          designation:      body.designation,
          joiningDate:      body.joiningDate ? new Date(body.joiningDate) : null,
          department:       body.department,
          reportingManager: body.reportingManager,
          workLocation:     body.workLocation,
          employmentType:   (body.employmentType as 'PERMANENT' | 'CONTRACT' | 'COMMISSION_BASED' | 'CONSULTANT' | 'INTERN') ?? 'PERMANENT',
          content,
          createdBy:        body.createdBy,
        },
      })

      return NextResponse.json({ success: true, data: letter }, { status: 201 })
    } catch (e) {
      return createErrorResponse(e instanceof Error ? e.message : 'Failed', 500)
    }
  }
)
