// ============================================================================
// GET /api/core/businesses/[businessId]/reports/customers
// Customer analytics: acquisition, retention, LTV, top spenders, loyalty tiers
// Query params: from, to (ISO dates)
// ============================================================================

import { NextResponse } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'
import type { NextRequest } from 'next/server'

type Ctx = { params?: Promise<Record<string, string | string[]>> }

export const GET = withMiddleware({ requireAuth: true })(
  async (req: NextRequest, ctx?: Ctx) => {
    try {
      const businessId = ((await ctx?.params)?.businessId) as string | undefined
      if (!businessId) return createErrorResponse('Missing businessId', 400)

      const { searchParams } = new URL(req.url)
      const from = searchParams.get('from') ? new Date(searchParams.get('from')!) : new Date(Date.now() - 30 * 86400000)
      const to   = searchParams.get('to')   ? new Date(searchParams.get('to')!)   : new Date()

      const [allCustomers, newCustomers, orders] = await Promise.all([
        db.customer.findMany({
          where: { businessId, isActive: true },
          select: {
            id: true, name: true, email: true, phone: true,
            totalOrders: true, totalSpent: true, avgOrderValue: true,
            loyaltyTier: true, loyaltyPoints: true, lastOrderAt: true, createdAt: true,
          },
          orderBy: { totalSpent: 'desc' },
        }),
        db.customer.count({
          where: { businessId, isActive: true, createdAt: { gte: from, lte: to } },
        }),
        db.order.findMany({
          where: { businessId, status: { notIn: ['CANCELLED'] }, createdAt: { gte: from, lte: to } },
          select: { customerId: true, totalAmount: true, createdAt: true },
        }),
      ])

      const total = allCustomers.length

      const loyaltyTierMap = allCustomers.reduce<Record<string, number>>((acc, c) => {
        acc[c.loyaltyTier] = (acc[c.loyaltyTier] ?? 0) + 1
        return acc
      }, {})

      const orderingCustomerIds = new Set(orders.map(o => o.customerId).filter(Boolean))
      const returningCount = allCustomers.filter(c => c.totalOrders > 1 && orderingCustomerIds.has(c.id)).length
      const retentionRate  = total > 0 ? (returningCount / total) * 100 : 0

      const avgLtv = allCustomers.reduce((s, c) => s + c.totalSpent, 0) / (total || 1)

      const topSpenders = allCustomers.slice(0, 10).map(c => ({
        id:              c.id,
        name:            c.name,
        email:           c.email,
        phone:           c.phone,
        totalOrders:     c.totalOrders,
        totalSpent:      c.totalSpent,
        avgOrderValue:   c.avgOrderValue,
        loyaltyTier:     c.loyaltyTier,
        loyaltyPoints:   c.loyaltyPoints,
        lastOrderAt:     c.lastOrderAt,
      }))

      const noOrderIn30Days = allCustomers.filter(c => {
        if (!c.lastOrderAt) return false
        return new Date().getTime() - new Date(c.lastOrderAt).getTime() > 30 * 86400000
      }).length

      return NextResponse.json({
        success: true,
        data: {
          period: { from: from.toISOString(), to: to.toISOString() },
          summary: {
            totalCustomers:    total,
            newCustomers,
            returningCustomers: returningCount,
            retentionRate:     Math.round(retentionRate * 100) / 100,
            avgLifetimeValue:  Math.round(avgLtv        * 100) / 100,
            atRiskCustomers:   noOrderIn30Days,
          },
          loyaltyTierBreakdown: loyaltyTierMap,
          topSpenders,
        },
      })
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : 'Failed to generate customer report', 500)
    }
  },
)
