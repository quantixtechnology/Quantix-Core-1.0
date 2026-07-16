// GET  /api/core/storefront/profile  — the logged-in customer's own profile
// PUT  /api/core/storefront/profile  — update the simple Customer Master fields
//
// Reuses the single Customer model. Kept intentionally lean: name / email /
// avatar / GST / date of birth / gender. Phone is NOT editable here (changing it
// requires OTP — a future feature). No preferences / language / new tables.
import { NextResponse } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'
import type { Role } from '@/lib/types'

const ROLES: Role[] = ['CUSTOMER', 'CLIENT_OWNER', 'STORE_MANAGER', 'STORE_OPERATOR', 'BILLING_STAFF', 'INVENTORY_STAFF', 'SUPPORT_STAFF', 'DELIVERY_STAFF']

const SELECT = {
  id: true, name: true, email: true, phone: true, avatar: true, gstNumber: true,
  dateOfBirth: true, gender: true, emailVerified: true, phoneVerified: true,
  loyaltyTier: true, loyaltyPoints: true, totalOrders: true, totalSpent: true,
} as const

export const GET = withMiddleware({ requireAuth: true, requiredRoles: ROLES })(
  async (req) => {
    try {
      const user = req.user!
      const customer = await db.customer.findFirst({ where: { userId: user.id, businessId: user.businessId! }, select: SELECT })
      if (!customer) return createErrorResponse('Customer profile not found', 404)
      return NextResponse.json({ success: true, data: customer })
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : 'Failed to get profile', 500)
    }
  },
)

export const PUT = withMiddleware({ requireAuth: true, requiredRoles: ROLES })(
  async (req) => {
    try {
      const user = req.user!
      const businessId = user.businessId!
      const body = await req.json() as {
        name?: string; email?: string; gstNumber?: string
        avatar?: string | null; dateOfBirth?: string | null; gender?: string | null
      }

      const customer = await db.customer.findFirst({ where: { userId: user.id, businessId } })
      if (!customer) return createErrorResponse('Customer profile not found', 404)

      const updated = await db.customer.update({
        where: { id: customer.id },
        data: {
          ...(body.name ? { name: body.name } : {}),
          ...(body.email !== undefined ? { email: body.email } : {}),
          ...(body.gstNumber !== undefined ? { gstNumber: body.gstNumber } : {}),
          ...(body.avatar !== undefined ? { avatar: body.avatar } : {}),
          ...(body.dateOfBirth !== undefined ? { dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null } : {}),
          ...(body.gender !== undefined ? { gender: body.gender } : {}),
        },
        select: SELECT,
      })
      return NextResponse.json({ success: true, data: updated })
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : 'Failed to update profile', 500)
    }
  },
)
