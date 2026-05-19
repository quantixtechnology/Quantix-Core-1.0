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

export interface OrderStage {
  status: string
  label: string
  order: number
}

// Default stage labels per business type
const DEFAULT_STAGES: Record<string, OrderStage[]> = {
  GROCERY: [
    { status: 'PENDING',          label: 'Pending',          order: 1 },
    { status: 'CONFIRMED',        label: 'Accepted',         order: 2 },
    { status: 'PREPARING',        label: 'Packing',          order: 3 },
    { status: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', order: 4 },
    { status: 'DELIVERED',        label: 'Delivered',        order: 5 },
    { status: 'CANCELLED',        label: 'Cancelled',        order: 6 },
  ],
  FOOD_DELIVERY: [
    { status: 'PENDING',          label: 'Pending',          order: 1 },
    { status: 'CONFIRMED',        label: 'Accepted',         order: 2 },
    { status: 'PREPARING',        label: 'Preparing',        order: 3 },
    { status: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', order: 4 },
    { status: 'DELIVERED',        label: 'Delivered',        order: 5 },
    { status: 'CANCELLED',        label: 'Cancelled',        order: 6 },
  ],
  MEAT_DELIVERY: [
    { status: 'PENDING',          label: 'Pending',          order: 1 },
    { status: 'CONFIRMED',        label: 'Accepted',         order: 2 },
    { status: 'PREPARING',        label: 'Cleaning',         order: 3 },
    { status: 'READY_FOR_PICKUP', label: 'Packing',          order: 4 },
    { status: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', order: 5 },
    { status: 'DELIVERED',        label: 'Delivered',        order: 6 },
    { status: 'CANCELLED',        label: 'Cancelled',        order: 7 },
  ],
  CAR_WASH: [
    { status: 'PENDING',   label: 'Booked',      order: 1 },
    { status: 'CONFIRMED', label: 'Assigned',    order: 2 },
    { status: 'PREPARING', label: 'In Progress', order: 3 },
    { status: 'DELIVERED', label: 'Completed',   order: 4 },
    { status: 'CANCELLED', label: 'Cancelled',   order: 5 },
  ],
  LAUNDRY: [
    { status: 'PENDING',          label: 'Pending',          order: 1 },
    { status: 'CONFIRMED',        label: 'Received',         order: 2 },
    { status: 'PREPARING',        label: 'Washing',          order: 3 },
    { status: 'READY_FOR_PICKUP', label: 'Ready',            order: 4 },
    { status: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', order: 5 },
    { status: 'DELIVERED',        label: 'Delivered',        order: 6 },
    { status: 'CANCELLED',        label: 'Cancelled',        order: 7 },
  ],
  PHARMACY: [
    { status: 'PENDING',          label: 'Pending',          order: 1 },
    { status: 'CONFIRMED',        label: 'Accepted',         order: 2 },
    { status: 'PREPARING',        label: 'Dispensing',       order: 3 },
    { status: 'READY_FOR_PICKUP', label: 'Ready',            order: 4 },
    { status: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', order: 5 },
    { status: 'DELIVERED',        label: 'Delivered',        order: 6 },
    { status: 'CANCELLED',        label: 'Cancelled',        order: 7 },
  ],
  HOME_SERVICES: [
    { status: 'PENDING',   label: 'Booked',      order: 1 },
    { status: 'CONFIRMED', label: 'Assigned',    order: 2 },
    { status: 'PREPARING', label: 'In Progress', order: 3 },
    { status: 'DELIVERED', label: 'Completed',   order: 4 },
    { status: 'CANCELLED', label: 'Cancelled',   order: 5 },
  ],
}

const ECOMMERCE_DEFAULT: OrderStage[] = [
  { status: 'PENDING',          label: 'Pending',    order: 1 },
  { status: 'CONFIRMED',        label: 'Confirmed',  order: 2 },
  { status: 'PREPARING',        label: 'Processing', order: 3 },
  { status: 'OUT_FOR_DELIVERY', label: 'Shipped',    order: 4 },
  { status: 'DELIVERED',        label: 'Delivered',  order: 5 },
  { status: 'CANCELLED',        label: 'Cancelled',  order: 6 },
]

function getDefaultStages(businessType: string): OrderStage[] {
  return DEFAULT_STAGES[businessType] ?? ECOMMERCE_DEFAULT
}

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
