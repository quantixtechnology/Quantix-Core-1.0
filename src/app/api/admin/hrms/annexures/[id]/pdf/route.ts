import type { NextRequest } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'
import { renderAnnexurePdf, fetchHrmsBranding } from '@/lib/hrms/pdf-renderer'

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

      const annexure = await db.annexure.findFirst({
        where: { id, deletedAt: null },
        include: {
          offerLetter: {
            select: { offerRef: true, candidateName: true, designation: true },
          },
        },
      })
      if (!annexure) return createErrorResponse('Not found', 404)

      const { hrms, platform } = await fetchHrmsBranding()

      const pdf = await renderAnnexurePdf(
        {
          id:          annexure.id,
          label:       annexure.label,
          annexureRef: annexure.annexureRef,
          title:       annexure.title,
          content:     annexure.content || '',
          createdAt:   annexure.createdAt,
          offerLetter: {
            offerRef:      annexure.offerLetter.offerRef,
            candidateName: annexure.offerLetter.candidateName,
            designation:   annexure.offerLetter.designation,
          },
        },
        hrms,
        platform,
      )

      const ref   = annexure.annexureRef || `Annexure-${annexure.label}`
      const filename = `${ref.replace(/\//g, '-')}.pdf`

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
