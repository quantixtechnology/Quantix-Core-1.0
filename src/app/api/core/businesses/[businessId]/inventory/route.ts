// ============================================================================
// GET   /api/core/businesses/[businessId]/inventory — List inventory (all stores)
// PATCH /api/core/businesses/[businessId]/inventory — Bulk adjust stock
// ============================================================================

import { NextResponse } from 'next/server'
import { withMiddleware, createErrorResponse, getPaginationParams } from '@/lib/middleware'
import { db } from '@/lib/db'
import type { NextRequest } from 'next/server'

interface AuthenticatedRequest extends NextRequest {
  user?: { id: string; name: string; email: string; role: string }
}

type Ctx = { params?: Promise<Record<string, string | string[]>> }

export const GET = withMiddleware({ requireAuth: true })(
  async (req: NextRequest, ctx?: Ctx) => {
    try {
      const businessId = ((await ctx?.params)?.businessId) as string | undefined
      if (!businessId) return createErrorResponse('Missing businessId', 400)

      const { page, limit, skip } = getPaginationParams(req)
      const { searchParams } = new URL(req.url)

      const storeId    = searchParams.get('storeId')    ?? undefined
      const status     = searchParams.get('status')     ?? undefined
      const productId  = searchParams.get('productId')  ?? undefined

      const where: Record<string, unknown> = { businessId }
      if (storeId)   where.storeId   = storeId
      if (status)    where.status    = status
      if (productId) where.productId = productId

      const [total, inventory] = await Promise.all([
        db.inventory.count({ where }),
        db.inventory.findMany({
          where,
          skip,
          take: limit,
          orderBy: { updatedAt: 'desc' },
          include: {
            product: { select: { id: true, name: true, sku: true, status: true } },
            variant: { select: { id: true, name: true, sku: true } },
            store:   { select: { id: true, name: true, storeCode: true } },
          },
        }),
      ])

      return NextResponse.json({
        success: true,
        data: inventory,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      })
    } catch (error) {
      return createErrorResponse(
        error instanceof Error ? error.message : 'Failed to list inventory',
        500,
      )
    }
  },
)

export const PATCH = withMiddleware({
  requireAuth: true,
  requiredRoles: ['CLIENT_OWNER', 'STORE_MANAGER', 'INVENTORY_STAFF', 'QUANTIX_SUPER_ADMIN'],
})(async (req: AuthenticatedRequest, ctx?: Ctx) => {
  try {
    const { businessId } = (await ctx?.params) ?? {}
    if (!businessId) return createErrorResponse('Missing businessId', 400)

    const user = req.user!
    const body = await req.json()

    // Expect: { adjustments: [{ inventoryId, quantity, note }] }
    const adjustments: Array<{ inventoryId: string; quantity: number; note?: string }> =
      body.adjustments ?? []

    if (!Array.isArray(adjustments) || adjustments.length === 0)
      return createErrorResponse('adjustments array is required', 400)

    const results = await db.$transaction(async (tx) => {
      const updated: Record<string, unknown>[] = []
      for (const adj of adjustments) {
        const inv = await tx.inventory.findUnique({ where: { id: adj.inventoryId } })
        if (!inv || inv.businessId !== businessId) continue

        const newQty     = Math.max(0, adj.quantity)
        const prevQty    = inv.quantity
        const newStatus  = newQty <= 0 ? 'OUT_OF_STOCK' : newQty <= inv.minStock ? 'LOW_STOCK' : 'IN_STOCK'

        const updatedInv = await tx.inventory.update({
          where: { id: adj.inventoryId },
          data:  { quantity: newQty, status: newStatus, lastRestockedAt: newQty > prevQty ? new Date() : undefined },
        })

        await tx.inventoryLog.create({
          data: {
            inventoryId: adj.inventoryId,
            action:      'MANUAL_ADJUST',
            quantity:    newQty - prevQty,
            previousQty: prevQty,
            newQty,
            note:        adj.note ?? 'Manual adjustment',
            performedBy: user.id,
          },
        })

        updated.push(updatedInv as Record<string, unknown>)
      }
      return updated
    })

    return NextResponse.json({ success: true, data: results })
  } catch (error) {
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to adjust inventory',
      500,
    )
  }
})
