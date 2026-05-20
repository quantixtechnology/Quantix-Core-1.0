// GET  /api/core/storefront/profile  — Get the logged-in customer's own profile
// PUT  /api/core/storefront/profile  — Update name, email, phone, gstNumber
import { NextResponse } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'

export const GET = withMiddleware({ requireAuth: true, requiredRoles: ['CUSTOMER'] })(
  async (req) => {
    try {
      const user = req.user!
      const businessId = user.businessId!

      const customer = await db.customer.findFirst({
        where: { userId: user.id, businessId },
        select: {
          id: true, name: true, email: true, phone: true, avatar: true,
          gstNumber: true, loyaltyTier: true, loyaltyPoints: true,
          totalOrders: true, totalSpent: true,
        },
      })

      if (!customer) return createErrorResponse('Customer profile not found', 404)

      return NextResponse.json({ success: true, data: customer })
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : 'Failed to get profile', 500)
    }
  },
)

export const PUT = withMiddleware({ requireAuth: true, requiredRoles: ['CUSTOMER'] })(
  async (req) => {
    try {
      const user = req.user!
      const businessId = user.businessId!
      const body = await req.json() as { name?: string; email?: string; phone?: string; gstNumber?: string }

      const customer = await db.customer.findFirst({ where: { userId: user.id, businessId } })
      if (!customer) return createErrorResponse('Customer profile not found', 404)

      if (body.phone && body.phone !== customer.phone) {
        const conflict = await db.customer.findFirst({
          where: { businessId, phone: body.phone, id: { not: customer.id } },
        })
        if (conflict) return createErrorResponse('Phone number already in use', 409)
      }

      const updated = await db.customer.update({
        where: { id: customer.id },
        data: {
          ...(body.name ? { name: body.name } : {}),
          ...(body.email !== undefined ? { email: body.email } : {}),
          ...(body.phone !== undefined ? { phone: body.phone } : {}),
          ...(body.gstNumber !== undefined ? { gstNumber: body.gstNumber } : {}),
        },
        select: {
          id: true, name: true, email: true, phone: true, avatar: true,
          gstNumber: true, loyaltyTier: true, loyaltyPoints: true,
          totalOrders: true, totalSpent: true,
        },
      })

      return NextResponse.json({ success: true, data: updated })
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : 'Failed to update profile', 500)
    }
  },
)
