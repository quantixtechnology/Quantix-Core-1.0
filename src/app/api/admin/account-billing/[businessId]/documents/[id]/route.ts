// GET   /api/admin/account-billing/[businessId]/documents/[id]
// PATCH /api/admin/account-billing/[businessId]/documents/[id]
// View or transition status of a BillingDocument.

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { withMiddleware } from '@/lib/middleware'
import type { NextRequest } from 'next/server'

const VALID_STATUSES = ['Draft', 'Sent', 'Accepted', 'Expired', 'Cancelled', 'Partially Paid', 'Paid']

// Allowed status transitions
const TRANSITIONS: Record<string, string[]> = {
  Draft:          ['Sent', 'Cancelled'],
  Sent:           ['Accepted', 'Expired', 'Cancelled'],
  Accepted:       ['Paid', 'Partially Paid', 'Cancelled'],
  'Partially Paid': ['Paid', 'Cancelled'],
  Expired:        ['Cancelled'],
  Cancelled:      [],
  Paid:           [],
}

export const GET = withMiddleware({
  requireAuth: true,
  requiredPermission: 'subscriptions:view',
})(async (_req: NextRequest, context) => {
  try {
    const params = await context?.params
    const { businessId, id } = params as { businessId: string; id: string }

    const doc = await db.billingDocument.findFirst({ where: { id, businessId } })
    if (!doc) return NextResponse.json({ success: false, error: 'Document not found' }, { status: 404 })

    return NextResponse.json({ success: true, data: doc })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch document'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})

export const PATCH = withMiddleware({
  requireAuth: true,
  requiredRoles: ['QUANTIX_SUPER_ADMIN', 'PLATFORM_ADMIN', 'FINANCE_TEAM'],
})(async (req: NextRequest, context) => {
  try {
    const params = await context?.params
    const { businessId, id } = params as { businessId: string; id: string }

    const body = await req.json() as {
      status?: string
      notes?: string
      validUntil?: string
      sentAt?: string
      acceptedAt?: string
      paidDate?: string
    }

    const doc = await db.billingDocument.findFirst({ where: { id, businessId } })
    if (!doc) return NextResponse.json({ success: false, error: 'Document not found' }, { status: 404 })

    if (body.status) {
      if (!VALID_STATUSES.includes(body.status)) {
        return NextResponse.json({ success: false, error: `Invalid status: ${body.status}` }, { status: 400 })
      }
      const allowed = TRANSITIONS[doc.status] ?? []
      if (!allowed.includes(body.status)) {
        return NextResponse.json({
          success: false,
          error: `Cannot transition from ${doc.status} to ${body.status}. Allowed: ${allowed.join(', ') || 'none'}`,
        }, { status: 422 })
      }
    }

    const updateData: Record<string, unknown> = {}
    if (body.status)     updateData.status = body.status
    if (body.notes !== undefined) updateData.notes = body.notes
    if (body.validUntil) updateData.validUntil = new Date(body.validUntil)
    if (body.sentAt)     updateData.sentAt = new Date(body.sentAt)
    if (body.acceptedAt) updateData.acceptedAt = new Date(body.acceptedAt)
    if (body.paidDate)   updateData.paidDate = new Date(body.paidDate)

    // Auto-set timestamps on status change
    if (body.status === 'Sent' && !body.sentAt)         updateData.sentAt = new Date()
    if (body.status === 'Accepted' && !body.acceptedAt) updateData.acceptedAt = new Date()
    if ((body.status === 'Paid' || body.status === 'Partially Paid') && !body.paidDate) updateData.paidDate = new Date()

    const updated = await db.billingDocument.update({ where: { id }, data: updateData })
    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update document'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
