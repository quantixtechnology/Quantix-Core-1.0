// ============================================================================
// Storefront Address API — customer's own address book
// GET  /api/core/storefront/addresses  — list addresses
// POST /api/core/storefront/addresses  — add address
// Auth: CUSTOMER role (token from OTP login)
// ============================================================================

import { NextResponse } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'

async function resolveCustomer(userId: string, businessId: string) {
  return db.customer.findFirst({ where: { userId, businessId } })
}

export const GET = withMiddleware({ requireAuth: true, requiredRoles: ['CUSTOMER'] })(
  async (req) => {
    try {
      const user = req.user!
      const businessId = user.businessId!

      const customer = await resolveCustomer(user.id, businessId)
      if (!customer) return NextResponse.json({ success: true, data: [] })

      const addresses = await db.address.findMany({
        where: { customerId: customer.id },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      })

      return NextResponse.json({ success: true, data: addresses })
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : 'Failed to list addresses', 500)
    }
  },
)

export const POST = withMiddleware({ requireAuth: true, requiredRoles: ['CUSTOMER'] })(
  async (req) => {
    try {
      const user = req.user!
      const businessId = user.businessId!

      const body = await req.json() as {
        label?: string
        area?: string
        line1?: string; addressLine1?: string
        line2?: string; addressLine2?: string
        landmark?: string
        city: string
        state?: string
        pincode: string
        latitude?: number
        longitude?: number
        gpsAccuracy?: number
        instructions?: string
        isDefault?: boolean
      }

      const addressLine1 = body.line1 || body.addressLine1
      if (!addressLine1 || !body.city || !body.pincode) {
        return createErrorResponse('line1, city, pincode are required', 400)
      }

      let customer = await resolveCustomer(user.id, businessId)
      if (!customer) {
        customer = await db.customer.create({
          data: { businessId, userId: user.id, name: user.name },
        })
      }

      if (body.isDefault) {
        await db.address.updateMany({ where: { customerId: customer.id }, data: { isDefault: false } })
      }

      const isFirst = (await db.address.count({ where: { customerId: customer.id } })) === 0

      const address = await db.address.create({
        data: {
          customerId: customer.id,
          label: body.label,
          area: body.area,
          addressLine1,
          addressLine2: body.line2 || body.addressLine2,
          landmark: body.landmark,
          city: body.city,
          state: body.state || 'Karnataka',
          pincode: body.pincode,
          country: 'India',
          latitude: body.latitude,
          longitude: body.longitude,
          gpsAccuracy: body.gpsAccuracy,
          instructions: body.instructions,
          isDefault: body.isDefault ?? isFirst,
        },
      })

      return NextResponse.json({ success: true, data: address }, { status: 201 })
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : 'Failed to create address', 500)
    }
  },
)
