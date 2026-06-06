import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'

function renderTemplate(content: string, data: Record<string, string>): string {
  return content.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] ?? `{{${key}}}`)
}

// Assigns the next sequential offer number and renders the template.
// Must only be called once per draft — returns 400 if already generated.
type Ctx = { params?: Promise<Record<string, string | string[]>> }

const getId = async (ctx?: Ctx) => {
  const p = await ctx?.params
  return Array.isArray(p?.id) ? p?.id[0] : p?.id
}

export const POST = withMiddleware({ requireAuth: true, requiredPermission: 'hrms:manage' })(
  async (_req: NextRequest, ctx?: Ctx) => {
    try {
      const id = await getId(ctx)
      if (!id) return createErrorResponse('id required', 400)

      const existing = await db.offerLetter.findUnique({ where: { id } })
      if (!existing || existing.deletedAt) return createErrorResponse('Not found', 404)
      if (existing.offerRef) {
        return createErrorResponse('Offer letter already generated — number cannot be reassigned', 400)
      }

      // Assign next sequential number for the current year
      const year = new Date().getFullYear().toString()
      const seq = await db.offerLetterSequence.upsert({
        where:  { yearKey: year },
        update: { nextVal: { increment: 1 } },
        create: { yearKey: year, nextVal: 2 },
      })
      const offerRef = `QT/HR/${year}/${String(seq.nextVal - 1).padStart(5, '0')}`

      // Render template with current candidate data
      let content = existing.content || ''
      if (existing.templateId) {
        const tpl = await db.offerLetterTemplate.findUnique({ where: { id: existing.templateId } })
        if (tpl) {
          const mergeData: Record<string, string> = {
            CandidateName:    existing.candidateName ?? '',
            Designation:      existing.designation ?? '',
            JoiningDate:      existing.joiningDate
              ? existing.joiningDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
              : '',
            ReportingManager: existing.reportingManager ?? '',
            WorkLocation:     existing.workLocation ?? '',
            Department:       existing.department ?? '',
            EmploymentType:   existing.employmentType ?? '',
          }
          content = renderTemplate(tpl.content, mergeData)
        }
      }

      const letter = await db.offerLetter.update({
        where: { id },
        data:  { offerRef, content },
      })

      await db.hrmsAuditLog.create({
        data: {
          module:   'OFFER_LETTER',
          entityId: id,
          action:   'Offer letter generated',
          newValue: offerRef,
        },
      })

      return NextResponse.json({ success: true, data: letter })
    } catch (e) {
      return createErrorResponse(e instanceof Error ? e.message : 'Failed', 500)
    }
  }
)
