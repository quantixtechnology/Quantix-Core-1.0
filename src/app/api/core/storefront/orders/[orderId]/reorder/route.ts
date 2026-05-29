// POST /api/core/storefront/orders/[orderId]/reorder
// Returns cart-ready items from a past order so the client can re-add them
import { NextResponse } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'

export const POST = withMiddleware({ requireAuth: true, requiredRoles: ['CUSTOMER', 'CLIENT_OWNER', 'STORE_MANAGER', 'STORE_OPERATOR', 'BILLING_STAFF', 'INVENTORY_STAFF', 'SUPPORT_STAFF', 'DELIVERY_STAFF'] })(
  async (req, context) => {
    try {
      const params = await context?.params
      const orderId = params?.orderId as string
      const user = req.user!
      const businessId = user.businessId!

      const customer = await db.customer.findFirst({ where: { userId: user.id, businessId } })
      if (!customer) return createErrorResponse('Customer profile not found', 404)

      const order = await db.order.findFirst({
        where: { id: orderId, customerId: customer.id, businessId },
        include: { items: true },
      })

      if (!order) return createErrorResponse('Order not found', 404)

      const cartItems = order.items.map((item) => {
        let image = ''
        let variantId = 'default'
        try {
          const meta = JSON.parse(item.metadata || '{}') as Record<string, unknown>
          if (typeof meta.image === 'string') image = meta.image
          if (typeof meta.variantId === 'string') variantId = meta.variantId
        } catch { /* ignore */ }

        return {
          productId: item.itemId,
          variantId,
          name: item.itemName,
          variantName: item.variantName || '',
          price: item.unitPrice,
          mrp: item.mrp ?? item.unitPrice,
          quantity: item.quantity,
          image,
          isVeg: item.isVeg ?? false,
        }
      })

      return NextResponse.json({ success: true, data: cartItems })
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : 'Failed to reorder', 500)
    }
  },
)
