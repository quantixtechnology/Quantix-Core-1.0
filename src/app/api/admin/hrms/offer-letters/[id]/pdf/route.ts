import type { NextRequest } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'
import { renderOfferLetterPdf, fetchHrmsBranding } from '@/lib/hrms/pdf-renderer'

type Ctx = { params?: Promise<Record<string, string | string[]>> }

const getId = async (ctx?: Ctx) => {
  const p = await ctx?.params
  return Array.isArray(p?.id) ? p?.id[0] : p?.id
}

export const GET = withMiddleware({ requireAuth: true, requiredPermission: 'hrms:view' })(
  async (_req: NextRequest, ctx?: Ctx) => {
    try {
      const id = await getId(ctx)
      if (!id) return createErrorResponse('id required', 400)

      const letter = await db.offerLetter.findFirst({ where: { id, deletedAt: null } })
      if (!letter) return createErrorResponse('Not found', 404)

      const { hrms, platform } = await fetchHrmsBranding()

      const pdf = await renderOfferLetterPdf(
        {
          id:               letter.id,
          offerRef:         letter.offerRef,
          candidateName:    letter.candidateName,
          candidateEmail:   letter.candidateEmail,
          candidateMobile:  letter.candidateMobile,
          designation:      letter.designation,
          department:       letter.department,
          reportingManager: letter.reportingManager,
          workLocation:     letter.workLocation,
          joiningDate:      letter.joiningDate,
          employmentType:   letter.employmentType,
          content:          letter.content || '',
          createdAt:        letter.createdAt,
        },
        hrms,
        platform,
      )

      const filename = `offer-letter-${(letter.offerRef || letter.id).replace(/\//g, '-')}.pdf`

      return new Response(new Uint8Array(pdf), {
        headers: {
          'Content-Type':        'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length':      String(pdf.length),
        },
      })
    } catch (e) {
      return createErrorResponse(e instanceof Error ? e.message : 'PDF generation failed', 500)
    }
  }
)
