// POST /api/core/storefront/support/ticket
// Creates a support ticket. Auth optional — guests can submit with name/phone.
import { NextResponse } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'

export const POST = withMiddleware({ requireAuth: false })(
  async (req) => {
    try {
      const body = await req.json() as {
        businessId?: string
        name?: string
        phone?: string
        subject?: string
        category?: string
        message?: string
      }

      const { businessId, name, phone, subject, category, message } = body

      if (!businessId) return createErrorResponse('businessId is required', 400)
      if (!name?.trim()) return createErrorResponse('name is required', 400)
      if (!subject?.trim()) return createErrorResponse('subject is required', 400)
      if (!message?.trim()) return createErrorResponse('message is required', 400)

      const user = req.user
      let customerId: string | null = null
      if (user?.id) {
        const customer = await db.customer.findFirst({ where: { userId: user.id, businessId } })
        if (customer) customerId = customer.id
      }

      const ticket = await db.supportTicket.create({
        data: {
          businessId,
          customerId,
          name: name.trim(),
          phone: phone?.trim() || null,
          subject: subject.trim(),
          category: category || 'OTHER',
          message: message.trim(),
          status: 'OPEN',
        },
      })

      return NextResponse.json({ success: true, data: { id: ticket.id, status: ticket.status } })
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : 'Failed to create ticket', 500)
    }
  },
)
