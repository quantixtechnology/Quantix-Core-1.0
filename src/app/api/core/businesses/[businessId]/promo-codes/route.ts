// ============================================================================
// GET    /api/core/businesses/[businessId]/promo-codes — List promo codes
// POST   /api/core/businesses/[businessId]/promo-codes — Create promo code
// DELETE /api/core/businesses/[businessId]/promo-codes — Deactivate promo code
// ============================================================================

import { NextResponse } from 'next/server'
import { withMiddleware, createErrorResponse, getPaginationParams } from '@/lib/middleware'
import { db } from '@/lib/db'
import type { NextRequest } from 'next/server'

type Ctx = { params?: Promise<Record<string, string | string[]>> }

export const GET = withMiddleware({ requireAuth: true })(
  async (req: NextRequest, ctx?: Ctx) => {
    try {
      const businessId = ((await ctx?.params)?.businessId) as string | undefined
      if (!businessId) return createErrorResponse('Missing businessId', 400)

      const { page, limit, skip } = getPaginationParams(req)
      const { searchParams } = new URL(req.url)

      const isActive = searchParams.get('isActive')
      const search   = searchParams.get('search') ?? ''

      const where: Record<string, unknown> = { businessId }
      if (isActive !== null) where.isActive = isActive === 'true'
      if (search) where.OR = [
        { code:        { contains: search } },
        { description: { contains: search } },
      ]

      const [total, promoCodes] = await Promise.all([
        db.promoCode.count({ where }),
        db.promoCode.findMany({
          where,
          skip,
          take:     limit,
          orderBy:  { createdAt: 'desc' },
        }),
      ])

      return NextResponse.json({
        success: true,
        data: promoCodes,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      })
    } catch (error) {
      return createErrorResponse(
        error instanceof Error ? error.message : 'Failed to list promo codes',
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
    const { code, type, value, validFrom, validUntil } = body

    if (!code || !type || value === undefined || !validFrom || !validUntil)
      return createErrorResponse('code, type, value, validFrom, validUntil are required', 400)

    const upperCode = String(code).toUpperCase().trim()
    const existing  = await db.promoCode.findFirst({ where: { businessId, code: upperCode } })
    if (existing) return createErrorResponse(`Promo code "${upperCode}" already exists`, 409)

    const promo = await db.promoCode.create({
      data: {
        businessId,
        code:            upperCode,
        description:     body.description     ?? null,
        type,
        value:           Number(value),
        minOrderAmount:  body.minOrderAmount  !== undefined ? Number(body.minOrderAmount)  : 0,
        maxDiscount:     body.maxDiscount     !== undefined ? Number(body.maxDiscount)     : null,
        usageLimit:      body.usageLimit      !== undefined ? Number(body.usageLimit)      : null,
        perUserLimit:    body.perUserLimit    !== undefined ? Number(body.perUserLimit)    : 1,
        validFrom:       new Date(validFrom),
        validUntil:      new Date(validUntil),
        isActive:        true,
        applicableModules: JSON.stringify(body.applicableModules ?? []),
      },
    })

    return NextResponse.json({ success: true, data: promo }, { status: 201 })
  } catch (error) {
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to create promo code',
      500,
    )
  }
})

export const DELETE = withMiddleware({
  requireAuth: true,
  requiredRoles: ['CLIENT_OWNER', 'QUANTIX_SUPER_ADMIN'],
})(async (req: NextRequest, ctx?: Ctx) => {
  try {
    const businessId = ((await ctx?.params)?.businessId) as string | undefined
    if (!businessId) return createErrorResponse('Missing businessId', 400)

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return createErrorResponse('id query param is required', 400)

    const existing = await db.promoCode.findFirst({ where: { id, businessId } })
    if (!existing) return createErrorResponse('Promo code not found', 404)

    await db.promoCode.update({ where: { id }, data: { isActive: false } })

    return NextResponse.json({ success: true, message: 'Promo code deactivated' })
  } catch (error) {
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to deactivate promo code',
      500,
    )
  }
})
