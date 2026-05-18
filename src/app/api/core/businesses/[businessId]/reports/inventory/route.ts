// ============================================================================
// GET /api/core/businesses/[businessId]/reports/inventory
// Inventory health: stock levels, low-stock alerts, movement summary
// Query params: storeId, status (IN_STOCK|LOW_STOCK|OUT_OF_STOCK), from, to
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
      const status  = searchParams.get('status')  ?? undefined
      const from    = searchParams.get('from') ? new Date(searchParams.get('from')!) : new Date(Date.now() - 30 * 86400000)
      const to      = searchParams.get('to')   ? new Date(searchParams.get('to')!)   : new Date()

      const inventoryWhere: Record<string, unknown> = {
        product: { businessId },
      }
      if (storeId) inventoryWhere.storeId = storeId
      if (status)  inventoryWhere.status  = status

      const [inventory, logs] = await Promise.all([
        db.inventory.findMany({
          where: inventoryWhere,
          include: {
            product: { select: { id: true, name: true, sku: true, businessId: true } },
            store:   { select: { id: true, name: true } },
          },
          orderBy: { quantity: 'asc' },
        }),
        db.inventoryLog.findMany({
          where: {
            createdAt: { gte: from, lte: to },
            inventory: { product: { businessId }, ...(storeId ? { storeId } : {}) },
          },
          select: { action: true, quantity: true, previousQty: true, newQty: true, createdAt: true, note: true },
          orderBy: { createdAt: 'desc' },
          take: 500,
        }),
      ])

      const statusCounts = inventory.reduce<Record<string, number>>((acc, i) => {
        acc[i.status] = (acc[i.status] ?? 0) + 1
        return acc
      }, {})

      const totalSkus      = inventory.length
      const inStockCount   = statusCounts['IN_STOCK']   ?? 0
      const lowStockCount  = statusCounts['LOW_STOCK']  ?? 0
      const outOfStockCount = statusCounts['OUT_OF_STOCK'] ?? 0

      const totalValue = inventory.reduce((s, i) => s + i.quantity, 0)

      const lowStockItems = inventory
        .filter(i => i.status === 'LOW_STOCK' || i.status === 'OUT_OF_STOCK')
        .map(i => ({
          inventoryId: i.id,
          productId:   i.productId,
          productName: i.product.name,
          sku:         i.product.sku,
          storeId:     i.storeId,
          storeName:   i.store.name,
          quantity:    i.quantity,
          minStock:    i.minStock,
          status:      i.status,
        }))
        .slice(0, 50)

      const movementByType = logs.reduce<Record<string, { count: number; totalChange: number }>>((acc, l) => {
        if (!acc[l.action]) acc[l.action] = { count: 0, totalChange: 0 }
        acc[l.action].count++
        acc[l.action].totalChange += l.newQty - l.previousQty
        return acc
      }, {})

      return NextResponse.json({
        success: true,
        data: {
          period: { from: from.toISOString(), to: to.toISOString() },
          summary: {
            totalSkus,
            inStockCount,
            lowStockCount,
            outOfStockCount,
            totalUnitsOnHand: totalValue,
          },
          lowStockAlerts: lowStockItems,
          movementSummary: movementByType,
          recentMovements: logs.slice(0, 50),
        },
      })
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : 'Failed to generate inventory report', 500)
    }
  },
)
