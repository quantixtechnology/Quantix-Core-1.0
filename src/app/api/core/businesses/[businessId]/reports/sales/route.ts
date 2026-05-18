// ============================================================================
// GET /api/core/businesses/[businessId]/reports/sales
// Sales report: order counts, revenue, AOV, payment breakdown, top products
// Query params: from, to (ISO dates), storeId, groupBy (day|week|month)
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
      const storeId  = searchParams.get('storeId') ?? undefined
      const from     = searchParams.get('from')    ? new Date(searchParams.get('from')!) : new Date(Date.now() - 30 * 86400000)
      const to       = searchParams.get('to')      ? new Date(searchParams.get('to')!)   : new Date()
      const groupBy  = searchParams.get('groupBy') ?? 'day'

      const where: Record<string, unknown> = {
        businessId,
        createdAt: { gte: from, lte: to },
        status: { notIn: ['CANCELLED'] },
      }
      if (storeId) where.storeId = storeId

      const [orders, orderItems, payments] = await Promise.all([
        db.order.findMany({
          where,
          select: {
            id: true, orderNumber: true, status: true, paymentStatus: true, paymentMethod: true,
            totalAmount: true, subtotal: true, totalTax: true, totalDiscount: true,
            deliveryFee: true, orderType: true, orderSource: true, storeId: true, createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        }),
        db.orderItem.findMany({
          where: { order: where },
          select: { itemId: true, itemName: true, quantity: true, unitPrice: true, totalPrice: true, gstRate: true, gstAmount: true },
        }),
        db.payment.findMany({
          where: { businessId, createdAt: { gte: from, lte: to }, status: 'COMPLETED' },
          select: { method: true, amount: true },
        }),
      ])

      const totalRevenue    = orders.reduce((s, o) => s + o.totalAmount, 0)
      const totalTax        = orders.reduce((s, o) => s + o.totalTax, 0)
      const totalDiscount   = orders.reduce((s, o) => s + o.totalDiscount, 0)
      const totalDelivery   = orders.reduce((s, o) => s + o.deliveryFee, 0)
      const orderCount      = orders.length
      const aov             = orderCount > 0 ? totalRevenue / orderCount : 0

      const statusBreakdown = orders.reduce<Record<string, number>>((acc, o) => {
        acc[o.status] = (acc[o.status] ?? 0) + 1
        return acc
      }, {})

      const typeBreakdown = orders.reduce<Record<string, number>>((acc, o) => {
        acc[o.orderType] = (acc[o.orderType] ?? 0) + 1
        return acc
      }, {})

      const paymentBreakdown = payments.reduce<Record<string, number>>((acc, p) => {
        acc[p.method] = (acc[p.method] ?? 0) + p.amount
        return acc
      }, {})

      const productMap = orderItems.reduce<Record<string, { name: string; qty: number; revenue: number }>>((acc, i) => {
        if (!acc[i.itemId]) acc[i.itemId] = { name: i.itemName, qty: 0, revenue: 0 }
        acc[i.itemId].qty     += i.quantity
        acc[i.itemId].revenue += i.totalPrice
        return acc
      }, {})
      const topProducts = Object.entries(productMap)
        .map(([id, v]) => ({ productId: id, ...v }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10)

      const fmt = (d: Date): string => {
        if (groupBy === 'month') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        if (groupBy === 'week')  {
          const startOfWeek = new Date(d)
          startOfWeek.setDate(d.getDate() - d.getDay())
          return startOfWeek.toISOString().slice(0, 10)
        }
        return d.toISOString().slice(0, 10)
      }

      const trend = orders.reduce<Record<string, { date: string; orders: number; revenue: number }>>((acc, o) => {
        const key = fmt(new Date(o.createdAt))
        if (!acc[key]) acc[key] = { date: key, orders: 0, revenue: 0 }
        acc[key].orders++
        acc[key].revenue += o.totalAmount
        return acc
      }, {})

      return NextResponse.json({
        success: true,
        data: {
          period: { from: from.toISOString(), to: to.toISOString(), groupBy },
          summary: {
            orderCount,
            totalRevenue:  Math.round(totalRevenue  * 100) / 100,
            totalTax:      Math.round(totalTax      * 100) / 100,
            totalDiscount: Math.round(totalDiscount * 100) / 100,
            totalDelivery: Math.round(totalDelivery * 100) / 100,
            aov:           Math.round(aov           * 100) / 100,
          },
          statusBreakdown,
          typeBreakdown,
          paymentBreakdown,
          topProducts,
          trend: Object.values(trend).sort((a, b) => a.date.localeCompare(b.date)),
        },
      })
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : 'Failed to generate sales report', 500)
    }
  },
)
