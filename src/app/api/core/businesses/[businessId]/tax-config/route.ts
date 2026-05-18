// ============================================================================
// GET  /api/core/businesses/[businessId]/tax-config — List tax configs
// POST /api/core/businesses/[businessId]/tax-config — Create tax config
// PUT  /api/core/businesses/[businessId]/tax-config — Update a tax config
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

      const where: Record<string, unknown> = { businessId }
      if (storeId) where.storeId = storeId

      const configs = await db.taxConfig.findMany({
        where,
        orderBy: { rate: 'asc' },
      })

      return NextResponse.json({ success: true, data: configs })
    } catch (error) {
      return createErrorResponse(
        error instanceof Error ? error.message : 'Failed to list tax configs',
        500,
      )
    }
  },
)

export const POST = withMiddleware({
  requireAuth: true,
  requiredRoles: ['CLIENT_OWNER', 'QUANTIX_SUPER_ADMIN'],
})(async (req: NextRequest, ctx?: Ctx) => {
  try {
    const businessId = ((await ctx?.params)?.businessId) as string | undefined
    if (!businessId) return createErrorResponse('Missing businessId', 400)

    const body = await req.json()
    const { name, taxType, rate, cgstRate, sgstRate, igstRate, cessRate, storeId, isDefault } = body

    if (!name || taxType === undefined || rate === undefined)
      return createErrorResponse('name, taxType, and rate are required', 400)

    if (isDefault) {
      await db.taxConfig.updateMany({
        where: { businessId, storeId: storeId ?? null },
        data:  { isDefault: false },
      })
    }

    const config = await db.taxConfig.create({
      data: {
        businessId,
        storeId:   storeId   ?? null,
        name,
        taxType,
        rate:      Number(rate),
        cgstRate:  cgstRate  !== undefined ? Number(cgstRate)  : null,
        sgstRate:  sgstRate  !== undefined ? Number(sgstRate)  : null,
        igstRate:  igstRate  !== undefined ? Number(igstRate)  : null,
        cessRate:  cessRate  !== undefined ? Number(cessRate)  : null,
        isDefault: Boolean(isDefault),
        isActive:  true,
      },
    })

    return NextResponse.json({ success: true, data: config }, { status: 201 })
  } catch (error) {
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to create tax config',
      500,
    )
  }
})

export const PUT = withMiddleware({
  requireAuth: true,
  requiredRoles: ['CLIENT_OWNER', 'QUANTIX_SUPER_ADMIN'],
})(async (req: NextRequest, ctx?: Ctx) => {
  try {
    const businessId = ((await ctx?.params)?.businessId) as string | undefined
    if (!businessId) return createErrorResponse('Missing businessId', 400)

    const body = await req.json()
    const { id, ...rest } = body

    if (!id) return createErrorResponse('id is required for update', 400)

    const existing = await db.taxConfig.findFirst({ where: { id, businessId } })
    if (!existing) return createErrorResponse('Tax config not found', 404)

    if (rest.isDefault) {
      await db.taxConfig.updateMany({
        where: { businessId, storeId: existing.storeId },
        data:  { isDefault: false },
      })
    }

    const updated = await db.taxConfig.update({
      where: { id },
      data:  {
        name:      rest.name      ?? existing.name,
        taxType:   rest.taxType   ?? existing.taxType,
        rate:      rest.rate      !== undefined ? Number(rest.rate)      : existing.rate,
        cgstRate:  rest.cgstRate  !== undefined ? Number(rest.cgstRate)  : existing.cgstRate,
        sgstRate:  rest.sgstRate  !== undefined ? Number(rest.sgstRate)  : existing.sgstRate,
        igstRate:  rest.igstRate  !== undefined ? Number(rest.igstRate)  : existing.igstRate,
        cessRate:  rest.cessRate  !== undefined ? Number(rest.cessRate)  : existing.cessRate,
        isDefault: rest.isDefault !== undefined ? Boolean(rest.isDefault) : existing.isDefault,
        isActive:  rest.isActive  !== undefined ? Boolean(rest.isActive)  : existing.isActive,
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to update tax config',
      500,
    )
  }
})
