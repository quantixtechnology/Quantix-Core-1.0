// ============================================================================
// Storefront Address API — single address operations
// PATCH  /api/core/storefront/addresses/[id]  — update / set default
// DELETE /api/core/storefront/addresses/[id]  — remove
// Auth: CUSTOMER role
// ============================================================================

import { NextResponse } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'

export const PATCH = withMiddleware({ requireAuth: true, requiredRoles: ['CUSTOMER', 'CLIENT_OWNER', 'STORE_MANAGER', 'STORE_OPERATOR', 'BILLING_STAFF', 'INVENTORY_STAFF', 'SUPPORT_STAFF', 'DELIVERY_STAFF'] })(
  async (req, context) => {
    try {
      const user = req.user!
      const businessId = user.businessId!
      const params = await context?.params
      const addressId = params?.id as string

      const customer = await db.customer.findFirst({ where: { userId: user.id, businessId } })
      if (!customer) return createErrorResponse('Customer not found', 404)

      const existing = await db.address.findFirst({ where: { id: addressId, customerId: customer.id } })
      if (!existing) return createErrorResponse('Address not found', 404)

      const body = await req.json() as {
        label?: string; area?: string; line1?: string; line2?: string
        landmark?: string; city?: string; state?: string; pincode?: string
        latitude?: number; longitude?: number; gpsAccuracy?: number
        googlePlaceId?: string; formattedAddress?: string
        instructions?: string; isDefault?: boolean
      }

      if (body.isDefault) {
        await db.address.updateMany({ where: { customerId: customer.id }, data: { isDefault: false } })
      }

      const updated = await db.address.update({
        where: { id: addressId },
        data: {
          ...(body.label !== undefined ? { label: body.label } : {}),
          ...(body.area !== undefined ? { area: body.area } : {}),
          ...(body.line1 !== undefined ? { addressLine1: body.line1 } : {}),
          ...(body.line2 !== undefined ? { addressLine2: body.line2 } : {}),
          ...(body.landmark !== undefined ? { landmark: body.landmark } : {}),
          ...(body.city !== undefined ? { city: body.city } : {}),
          ...(body.state !== undefined ? { state: body.state } : {}),
          ...(body.pincode !== undefined ? { pincode: body.pincode } : {}),
          ...(body.latitude !== undefined ? { latitude: body.latitude } : {}),
          ...(body.longitude !== undefined ? { longitude: body.longitude } : {}),
          ...(body.gpsAccuracy !== undefined ? { gpsAccuracy: body.gpsAccuracy } : {}),
          ...(body.googlePlaceId !== undefined ? { googlePlaceId: body.googlePlaceId } : {}),
          ...(body.formattedAddress !== undefined ? { formattedAddress: body.formattedAddress } : {}),
          ...(body.instructions !== undefined ? { instructions: body.instructions } : {}),
          ...(body.isDefault !== undefined ? { isDefault: body.isDefault } : {}),
        },
      })

      return NextResponse.json({ success: true, data: updated })
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : 'Failed to update address', 500)
    }
  },
)

export const DELETE = withMiddleware({ requireAuth: true, requiredRoles: ['CUSTOMER', 'CLIENT_OWNER', 'STORE_MANAGER', 'STORE_OPERATOR', 'BILLING_STAFF', 'INVENTORY_STAFF', 'SUPPORT_STAFF', 'DELIVERY_STAFF'] })(
  async (req, context) => {
    try {
      const user = req.user!
      const businessId = user.businessId!
      const params = await context?.params
      const addressId = params?.id as string

      const customer = await db.customer.findFirst({ where: { userId: user.id, businessId } })
      if (!customer) return createErrorResponse('Customer not found', 404)

      const existing = await db.address.findFirst({ where: { id: addressId, customerId: customer.id } })
      if (!existing) return createErrorResponse('Address not found', 404)

      await db.address.delete({ where: { id: addressId } })

      // If deleted was default, promote the most recent address to default
      if (existing.isDefault) {
        const next = await db.address.findFirst({
          where: { customerId: customer.id },
          orderBy: { createdAt: 'desc' },
        })
        if (next) await db.address.update({ where: { id: next.id }, data: { isDefault: true } })
      }

      return NextResponse.json({ success: true, message: 'Address deleted' })
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : 'Failed to delete address', 500)
    }
  },
)
