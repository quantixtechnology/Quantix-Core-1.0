// ============================================================================
// GET /api/core/app-readiness/delivery
// Returns the Delivery Partner App bootstrap payload for a given partner:
//   - Partner profile + vehicle info
//   - Business + store context
//   - Active deliveries assigned to this partner
//   - Earnings summary (today / lifetime)
// ============================================================================

import { NextResponse } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'

export const GET = withMiddleware({ requireAuth: true })(async (req) => {
  try {
    const user = req.user!
    const { searchParams } = new URL(req.url)
    const businessId = searchParams.get('businessId')

    if (!businessId) return createErrorResponse('businessId is required', 400)

    const { db } = await import('@/lib/db')

    const partner = await db.deliveryPartner.findFirst({
      where: { businessId, userId: user.id, isActive: true },
    })

    if (!partner) {
      return createErrorResponse('Delivery partner profile not found', 404)
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [activeDeliveries, todayDeliveries, totalDeliveries] = await Promise.all([
      db.delivery.findMany({
        where: {
          deliveryPartnerId: partner.id,
          status: { notIn: ['DELIVERED', 'FAILED', 'CANCELLED'] },
        },
        include: {
          order: {
            select: {
              id: true, orderNumber: true, totalAmount: true,
              customerName: true, customerPhone: true,
              deliveryAddress: true, deliveryLat: true, deliveryLng: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.delivery.count({
        where: {
          deliveryPartnerId: partner.id,
          status: 'DELIVERED',
          actualDeliveryTime: { gte: today },
        },
      }),
      db.delivery.count({
        where: { deliveryPartnerId: partner.id, status: 'DELIVERED' },
      }),
    ])

    const store = await db.store.findFirst({
      where: { businessId, isMainStore: true },
      select: { id: true, name: true, address: true, latitude: true, longitude: true },
    })

    return NextResponse.json({
      success: true,
      data: {
        partner: {
          id:            partner.id,
          name:          partner.name,
          phone:         partner.phone,
          vehicleType:   partner.vehicleType,
          vehicleNumber: partner.vehicleNumber,
          isOnline:      partner.isOnline,
          rating:        partner.rating,
          totalEarnings: partner.totalEarnings,
        },
        store,
        activeDeliveries,
        earnings: {
          todayDeliveries,
          totalDeliveries,
          totalEarnings: partner.totalEarnings,
        },
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load delivery app data'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
