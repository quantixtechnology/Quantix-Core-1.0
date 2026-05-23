// ============================================================================
// GET   /api/core/businesses/[businessId]/order-stages
// PATCH /api/core/businesses/[businessId]/order-stages
//
// Order stage labels are stored in Business.settings.orderStageConfig.
// Each stage maps an OrderStatus enum value to a human-readable label for
// that business type (e.g. PREPARING → "Cleaning" for MEAT_DELIVERY).
// Super Admin can customise; client cannot override.
// ============================================================================

import { NextResponse } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'
import type { NextRequest } from 'next/server'
import { type OrderStage, getDefaultStages } from '@/lib/order-stages'

export type { OrderStage }

type Ctx = { params?: Promise<Record<string, string | string[]>> }

export const GET = withMiddleware({ requireAuth: true })(
  async (_req: NextRequest, ctx?: Ctx) => {
    try {
      const businessId = ((await ctx?.params)?.businessId) as string | undefined
      if (!businessId) return createErrorResponse('Missing businessId', 400)

      const biz = await db.business.findUnique({
        where: { id: businessId },
        select: { businessType: true, settings: true },
      })
      if (!biz) return createErrorResponse('Business not found', 404)

      const settings = JSON.parse(biz.settings || '{}') as Record<string, unknown>
      const saved = settings.orderStageConfig as OrderStage[] | undefined

      const stages = saved && saved.length > 0 ? saved : getDefaultStages(biz.businessType)

      return NextResponse.json({
        success: true,
        data: {
          businessType: biz.businessType,
          stages,
          isCustomised: !!(saved && saved.length > 0),
        },
      })
    } catch (error) {
      return createErrorResponse(
        error instanceof Error ? error.message : 'Failed to get order stages',
        500,
      )
    }
  },
)

export const PATCH = withMiddleware({
  requireAuth: true,
  requiredRoles: ['QUANTIX_SUPER_ADMIN'],
})(async (req: NextRequest, ctx?: Ctx) => {
  try {
    const businessId = ((await ctx?.params)?.businessId) as string | undefined
    if (!businessId) return createErrorResponse('Missing businessId', 400)

    const body = await req.json()
    const stages: OrderStage[] = body.stages

    if (!Array.isArray(stages) || stages.length === 0)
      return createErrorResponse('stages array is required', 400)

    const biz = await db.business.findUnique({
      where: { id: businessId },
      select: { settings: true, businessType: true },
    })
    if (!biz) return createErrorResponse('Business not found', 404)

    const settings = JSON.parse(biz.settings || '{}') as Record<string, unknown>
    settings.orderStageConfig = stages

    await db.business.update({
      where: { id: businessId },
      data: { settings: JSON.stringify(settings) },
    })

    return NextResponse.json({ success: true, data: { stages } })
  } catch (error) {
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to save order stages',
      500,
    )
  }
})

export const DELETE = withMiddleware({
  requireAuth: true,
  requiredRoles: ['QUANTIX_SUPER_ADMIN'],
})(async (_req: NextRequest, ctx?: Ctx) => {
  try {
    const businessId = ((await ctx?.params)?.businessId) as string | undefined
    if (!businessId) return createErrorResponse('Missing businessId', 400)

    const biz = await db.business.findUnique({
      where: { id: businessId },
      select: { settings: true },
    })
    if (!biz) return createErrorResponse('Business not found', 404)

    const settings = JSON.parse(biz.settings || '{}') as Record<string, unknown>
    delete settings.orderStageConfig

    await db.business.update({
      where: { id: businessId },
      data: { settings: JSON.stringify(settings) },
    })

    return NextResponse.json({ success: true, message: 'Order stages reset to defaults' })
  } catch (error) {
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to reset order stages',
      500,
    )
  }
})
