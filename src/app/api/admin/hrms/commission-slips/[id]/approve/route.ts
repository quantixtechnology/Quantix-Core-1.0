import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'

type Ctx = { params?: Promise<Record<string, string | string[]>> }

// Only Super Admin can approve. Freezes the slip at current line amounts.
export const POST = withMiddleware({ requireAuth: true, requiredPermission: 'hrms:manage' })(
  async (req: NextRequest, ctx?: Ctx) => {
    try {
      const p = await ctx?.params
      const id = Array.isArray(p?.id) ? p?.id[0] : p?.id
      if (!id) return createErrorResponse('id required', 400)

      const body = await req.json() as { approvedBy?: string; action?: 'approve' | 'submit' | 'paid' }

      const slip = await db.commissionSlip.findUnique({ where: { id } })
      if (!slip || slip.deletedAt) return createErrorResponse('Not found', 404)

      const action = body.action ?? 'approve'
      let newStatus: 'DRAFT' | 'UNDER_REVIEW' | 'APPROVED' | 'PAID' = 'DRAFT'
      const now = new Date()

      if (action === 'submit') {
        if (slip.status !== 'DRAFT') return createErrorResponse('Only DRAFT slips can be submitted', 400)
        newStatus = 'UNDER_REVIEW'
      } else if (action === 'approve') {
        if (slip.status !== 'UNDER_REVIEW') return createErrorResponse('Only UNDER_REVIEW slips can be approved', 400)
        newStatus = 'APPROVED'
      } else if (action === 'paid') {
        if (slip.status !== 'APPROVED') return createErrorResponse('Only APPROVED slips can be marked Paid', 400)
        newStatus = 'PAID'
      }

      const updated = await db.commissionSlip.update({
        where: { id },
        data: {
          status:     newStatus,
          approvedBy: action === 'approve' ? (body.approvedBy ?? null) : undefined,
          approvedAt: action === 'approve' ? now : undefined,
          paidAt:     action === 'paid'    ? now : undefined,
        },
        include: { employee: { select: { id: true, name: true, employeeCode: true } } },
      })

      return NextResponse.json({ success: true, data: updated })
    } catch (e) {
      return createErrorResponse(e instanceof Error ? e.message : 'Failed', 500)
    }
  }
)
