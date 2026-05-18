// ============================================================================
// GET /api/core/businesses/[businessId]/reports/delivery
// Delivery performance: assignments, completion rate, partner stats, TAT
// Query params: from, to (ISO dates), storeId, partnerId
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
      const storeId   = searchParams.get('storeId')   ?? undefined
      const partnerId = searchParams.get('partnerId') ?? undefined
      const from      = searchParams.get('from') ? new Date(searchParams.get('from')!) : new Date(Date.now() - 30 * 86400000)
      const to        = searchParams.get('to')   ? new Date(searchParams.get('to')!)   : new Date()

      const orderWhere: Record<string, unknown> = { businessId }
      if (storeId) orderWhere.storeId = storeId

      const deliveryWhere: Record<string, unknown> = {
        order: orderWhere,
        createdAt: { gte: from, lte: to },
      }
      if (partnerId) deliveryWhere.deliveryPartnerId = partnerId

      const deliveries = await db.delivery.findMany({
        where: deliveryWhere,
        include: {
          deliveryPartner: { select: { id: true, name: true, phone: true, totalEarnings: true, totalDeliveries: true, rating: true } },
        },
        orderBy: { createdAt: 'desc' },
      })

      const total      = deliveries.length
      const delivered  = deliveries.filter(d => d.status === 'DELIVERED').length
      const failed     = deliveries.filter(d => d.status === 'FAILED').length
      const inProgress = deliveries.filter(d => !['DELIVERED', 'FAILED', 'CANCELLED'].includes(d.status)).length
      const completion = total > 0 ? (delivered / total) * 100 : 0

      const tatMs = deliveries
        .filter(d => d.status === 'DELIVERED' && d.actualDeliveryTime)
        .map(d => new Date(d.actualDeliveryTime!).getTime() - new Date(d.createdAt).getTime())
      const avgTatMin = tatMs.length > 0 ? tatMs.reduce((s, t) => s + t, 0) / tatMs.length / 60000 : 0

      const partnerMap = deliveries.reduce<Record<string, {
        partnerId: string; name: string; phone: string;
        assigned: number; delivered: number; failed: number;
        totalEarnings: number; totalDeliveries: number; rating: number
      }>>((acc, d) => {
        if (!d.deliveryPartnerId || !d.deliveryPartner) return acc
        if (!acc[d.deliveryPartnerId]) {
          acc[d.deliveryPartnerId] = {
            partnerId: d.deliveryPartnerId,
            name: d.deliveryPartner.name,
            phone: d.deliveryPartner.phone,
            assigned: 0, delivered: 0, failed: 0,
            totalEarnings: d.deliveryPartner.totalEarnings,
            totalDeliveries: d.deliveryPartner.totalDeliveries,
            rating: d.deliveryPartner.rating,
          }
        }
        acc[d.deliveryPartnerId].assigned++
        if (d.status === 'DELIVERED') acc[d.deliveryPartnerId].delivered++
        if (d.status === 'FAILED')    acc[d.deliveryPartnerId].failed++
        return acc
      }, {})

      const partnerStats = Object.values(partnerMap)
        .map(p => ({ ...p, completionRate: p.assigned > 0 ? Math.round((p.delivered / p.assigned) * 100) : 0 }))
        .sort((a, b) => b.delivered - a.delivered)
        .slice(0, 20)

      const statusBreakdown = deliveries.reduce<Record<string, number>>((acc, d) => {
        acc[d.status] = (acc[d.status] ?? 0) + 1
        return acc
      }, {})

      return NextResponse.json({
        success: true,
        data: {
          period: { from: from.toISOString(), to: to.toISOString() },
          summary: {
            total,
            delivered,
            failed,
            inProgress,
            completionRate:    Math.round(completion * 100) / 100,
            avgTurnaroundMins: Math.round(avgTatMin  * 100) / 100,
          },
          statusBreakdown,
          partnerStats,
        },
      })
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : 'Failed to generate delivery report', 500)
    }
  },
)
