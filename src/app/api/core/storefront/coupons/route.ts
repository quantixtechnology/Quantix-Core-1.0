// GET /api/core/storefront/coupons — list active promo codes for the current business
import { NextResponse } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'

export const GET = withMiddleware({ requireAuth: true, requiredRoles: ['CUSTOMER'] })(
  async (req) => {
    try {
      const businessId = req.user!.businessId!
      const now = new Date()

      const promoCodes = await db.promoCode.findMany({
        where: {
          businessId,
          isActive: true,
          validFrom: { lte: now },
          validUntil: { gte: now },
        },
        select: {
          id: true,
          code: true,
          description: true,
          type: true,
          value: true,
          minOrderAmount: true,
          maxDiscount: true,
          usageLimit: true,
          usedCount: true,
          validUntil: true,
        },
        orderBy: { createdAt: 'desc' },
      })

      const data = promoCodes.map((p) => ({
        id: p.id,
        code: p.code,
        description: p.description,
        type: p.type,
        value: p.value,
        minOrder: p.minOrderAmount,
        maxDiscount: p.maxDiscount,
        usageLeft: p.usageLimit != null ? p.usageLimit - p.usedCount : null,
        validUntil: p.validUntil,
      }))

      return NextResponse.json({ success: true, data })
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : 'Failed to fetch coupons', 500)
    }
  },
)
