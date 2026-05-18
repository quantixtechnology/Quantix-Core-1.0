// ============================================================================
// GET /api/core/businesses/[businessId]/reports/revenue
// Revenue trend report: daily/weekly/monthly revenue, MoM/WoW growth rates
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
      const storeId = searchParams.get('storeId') ?? undefined
      const to      = searchParams.get('to')   ? new Date(searchParams.get('to')!)   : new Date()
      const from    = searchParams.get('from') ? new Date(searchParams.get('from')!) : new Date(to.getTime() - 30 * 86400000)
      const groupBy = searchParams.get('groupBy') ?? 'day'

      const periodMs = to.getTime() - from.getTime()
      const prevFrom = new Date(from.getTime() - periodMs)
      const prevTo   = new Date(from.getTime() - 1)

      const where: Record<string, unknown> = {
        businessId,
        status: { notIn: ['CANCELLED'] },
      }
      if (storeId) where.storeId = storeId

      const [current, previous] = await Promise.all([
        db.order.findMany({
          where: { ...where, createdAt: { gte: from, lte: to } },
          select: { totalAmount: true, subtotal: true, totalTax: true, deliveryFee: true, orderType: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        }),
        db.order.findMany({
          where: { ...where, createdAt: { gte: prevFrom, lte: prevTo } },
          select: { totalAmount: true },
        }),
      ])

      const currentRevenue  = current.reduce((s, o) => s + o.totalAmount, 0)
      const previousRevenue = previous.reduce((s, o) => s + o.totalAmount, 0)
      const growth = previousRevenue > 0
        ? ((currentRevenue - previousRevenue) / previousRevenue) * 100
        : currentRevenue > 0 ? 100 : 0

      const fmt = (d: Date): string => {
        if (groupBy === 'month') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        if (groupBy === 'week')  {
          const startOfWeek = new Date(d)
          startOfWeek.setDate(d.getDate() - d.getDay())
          return startOfWeek.toISOString().slice(0, 10)
        }
        return d.toISOString().slice(0, 10)
      }

      const buckets = current.reduce<Record<string, { date: string; revenue: number; orders: number; tax: number; delivery: number }>>((acc, o) => {
        const key = fmt(new Date(o.createdAt))
        if (!acc[key]) acc[key] = { date: key, revenue: 0, orders: 0, tax: 0, delivery: 0 }
        acc[key].revenue  += o.totalAmount
        acc[key].orders++
        acc[key].tax      += o.totalTax
        acc[key].delivery += o.deliveryFee
        return acc
      }, {})

      const byType = current.reduce<Record<string, number>>((acc, o) => {
        acc[o.orderType] = (acc[o.orderType] ?? 0) + o.totalAmount
        return acc
      }, {})

      const trend = Object.values(buckets)
        .map(b => ({ ...b, revenue: Math.round(b.revenue * 100) / 100, tax: Math.round(b.tax * 100) / 100, delivery: Math.round(b.delivery * 100) / 100 }))
        .sort((a, b) => a.date.localeCompare(b.date))

      return NextResponse.json({
        success: true,
        data: {
          period: { from: from.toISOString(), to: to.toISOString(), groupBy },
          summary: {
            currentRevenue:  Math.round(currentRevenue  * 100) / 100,
            previousRevenue: Math.round(previousRevenue * 100) / 100,
            growthPercent:   Math.round(growth          * 100) / 100,
            currentOrders:   current.length,
            previousOrders:  previous.length,
          },
          byOrderType: byType,
          trend,
        },
      })
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : 'Failed to generate revenue report', 500)
    }
  },
)
