// ============================================================================
// GET /api/core/businesses/[businessId]/reports/tax
// GST tax report: CGST, SGST, IGST, CESS breakdown per slab, per store
// Query params: from, to (ISO dates), storeId, groupByMonth=true (last 6 months)
// ============================================================================

import { NextResponse } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'

type Ctx = { params?: Promise<Record<string, string | string[]>> }

export const GET = withMiddleware({ requireAuth: true })(
  async (req, ctx?: Ctx) => {
    try {
      const businessId = ((await ctx?.params)?.businessId) as string | undefined
      if (!businessId) return createErrorResponse('Missing businessId', 400)

      const { searchParams } = new URL(req.url)
      const storeId      = searchParams.get('storeId') ?? undefined
      const groupByMonth = searchParams.get('groupByMonth') === 'true'
      const from         = searchParams.get('from') ? new Date(searchParams.get('from')!) : new Date(Date.now() - 30 * 86400000)
      const to           = searchParams.get('to')   ? new Date(searchParams.get('to')!)   : new Date()

      // Monthly grouping: last 6 calendar months
      if (groupByMonth) {
        const now   = new Date()
        const months: { label: string; from: Date; to: Date }[] = []
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
          const monthFrom = new Date(d.getFullYear(), d.getMonth(), 1)
          const monthTo   = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
          const label     = d.toLocaleString('en-IN', { month: 'short', year: 'numeric' })
          months.push({ label, from: monthFrom, to: monthTo })
        }

        const monthlyData = await Promise.all(months.map(async (m) => {
          const where: Record<string, unknown> = {
            businessId,
            status: { notIn: ['CANCELLED'] },
            createdAt: { gte: m.from, lte: m.to },
          }
          if (storeId) where.storeId = storeId

          const orders = await db.order.findMany({
            where,
            select: {
              subtotal: true, totalTax: true,
              cgstAmount: true, sgstAmount: true, igstAmount: true,
            },
          })

          const taxable  = orders.reduce((s, o) => s + o.subtotal, 0)
          const cgst     = orders.reduce((s, o) => s + (o.cgstAmount ?? 0), 0)
          const sgst     = orders.reduce((s, o) => s + (o.sgstAmount ?? 0), 0)
          const igst     = orders.reduce((s, o) => s + (o.igstAmount ?? 0), 0)
          const totalTax = orders.reduce((s, o) => s + o.totalTax, 0)

          const roundTo2 = (n: number) => Math.round(n * 100) / 100
          return {
            month:         m.label,
            orderCount:    orders.length,
            taxableAmount: roundTo2(taxable),
            cgst:          roundTo2(cgst),
            sgst:          roundTo2(sgst),
            igst:          roundTo2(igst),
            totalTax:      roundTo2(totalTax),
          }
        }))

        return NextResponse.json({ success: true, data: { monthly: monthlyData } })
      }

      const orderWhere: Record<string, unknown> = {
        businessId,
        status: { notIn: ['CANCELLED'] },
        createdAt: { gte: from, lte: to },
      }
      if (storeId) orderWhere.storeId = storeId

      const [orders, orderItems] = await Promise.all([
        db.order.findMany({
          where: orderWhere,
          select: {
            id: true, orderNumber: true, storeId: true, createdAt: true,
            totalTax: true, cgstAmount: true, sgstAmount: true, igstAmount: true, cessAmount: true,
            totalAmount: true, subtotal: true,
          },
        }),
        db.orderItem.findMany({
          where: { order: orderWhere },
          select: { gstRate: true, gstAmount: true, cgstAmount: true, sgstAmount: true, totalPrice: true },
        }),
      ])

      const totalCGST  = orders.reduce((s, o) => s + (o.cgstAmount ?? 0), 0)
      const totalSGST  = orders.reduce((s, o) => s + (o.sgstAmount ?? 0), 0)
      const totalIGST  = orders.reduce((s, o) => s + (o.igstAmount ?? 0), 0)
      const totalCESS  = orders.reduce((s, o) => s + (o.cessAmount ?? 0), 0)
      const totalTax   = orders.reduce((s, o) => s + o.totalTax, 0)
      const taxable    = orders.reduce((s, o) => s + o.subtotal, 0)

      const slabMap = orderItems.reduce<Record<number, { rate: number; taxableAmount: number; cgst: number; sgst: number; totalTax: number }>>((acc, i) => {
        const rate = i.gstRate ?? 0
        if (!acc[rate]) acc[rate] = { rate, taxableAmount: 0, cgst: 0, sgst: 0, totalTax: 0 }
        acc[rate].taxableAmount += i.totalPrice - (i.gstAmount ?? 0)
        acc[rate].cgst          += i.cgstAmount ?? (i.gstAmount ?? 0) / 2
        acc[rate].sgst          += i.sgstAmount ?? (i.gstAmount ?? 0) / 2
        acc[rate].totalTax      += i.gstAmount ?? 0
        return acc
      }, {})

      const slabBreakdown = Object.values(slabMap).map(s => ({
        rate:          s.rate,
        taxableAmount: Math.round(s.taxableAmount * 100) / 100,
        cgst:          Math.round(s.cgst          * 100) / 100,
        sgst:          Math.round(s.sgst          * 100) / 100,
        totalTax:      Math.round(s.totalTax      * 100) / 100,
      })).sort((a, b) => a.rate - b.rate)

      return NextResponse.json({
        success: true,
        data: {
          period: { from: from.toISOString(), to: to.toISOString() },
          summary: {
            orderCount:    orders.length,
            taxableAmount: Math.round(taxable   * 100) / 100,
            cgst:          Math.round(totalCGST * 100) / 100,
            sgst:          Math.round(totalSGST * 100) / 100,
            igst:          Math.round(totalIGST * 100) / 100,
            cess:          Math.round(totalCESS * 100) / 100,
            totalTax:      Math.round(totalTax  * 100) / 100,
          },
          slabBreakdown,
        },
      })
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : 'Failed to generate tax report', 500)
    }
  },
)
