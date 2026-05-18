// ============================================================================
// GET  /api/core/businesses/[businessId]/products — List products
// POST /api/core/businesses/[businessId]/products — Create product
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

      const search       = searchParams.get('search')       ?? ''
      const categoryId   = searchParams.get('categoryId')   ?? undefined
      const storeId      = searchParams.get('storeId')      ?? undefined
      const status       = searchParams.get('status')       ?? 'ALL'
      const workflowType = searchParams.get('workflowType') ?? undefined

      const where: Record<string, unknown> = { businessId }
      if (categoryId)   where.categoryId   = categoryId
      if (storeId)      where.storeId      = storeId
      if (workflowType) where.workflowType = workflowType
      if (status !== 'ALL') where.status   = status

      if (search) {
        where.OR = [
          { name: { contains: search } },
          { sku:  { contains: search } },
          { barcode: { contains: search } },
        ]
      }

      const [total, products] = await Promise.all([
        db.product.count({ where }),
        db.product.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
          include: {
            category: { select: { id: true, name: true, slug: true } },
            variants:  { select: { id: true, name: true, price: true, mrp: true, isDefault: true, isActive: true } },
            inventory: { select: { storeId: true, quantity: true, reservedQty: true, status: true } },
          },
        }),
      ])

      return NextResponse.json({
        success: true,
        data: products,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      })
    } catch (error) {
      return createErrorResponse(
        error instanceof Error ? error.message : 'Failed to list products',
        500,
      )
    }
  },
)

export const POST = withMiddleware({
  requireAuth: true,
  requiredRoles: ['CLIENT_OWNER', 'STORE_MANAGER', 'QUANTIX_SUPER_ADMIN'],
})(async (req: NextRequest, ctx?: Ctx) => {
  try {
    const businessId = ((await ctx?.params)?.businessId) as string | undefined
    if (!businessId) return createErrorResponse('Missing businessId', 400)

    const body = await req.json()
    const { name, storeId, categoryId, variants = [] } = body

    if (!name) return createErrorResponse('name is required', 400)

    const slug = (body.slug || name)
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 80)

    const existingSlug = await db.product.findFirst({ where: { businessId, slug } })

    const product = await db.$transaction(async (tx) => {
      const p = await tx.product.create({
        data: {
          businessId,
          storeId:      storeId      ?? null,
          categoryId:   categoryId   ?? null,
          name,
          slug:         existingSlug ? `${slug}-${Date.now()}` : slug,
          description:  body.description  ?? null,
          shortDesc:    body.shortDesc    ?? null,
          type:         body.type         ?? 'PHYSICAL',
          status:       body.status       ?? 'ACTIVE',
          sku:          body.sku          ?? null,
          barcode:      body.barcode      ?? null,
          images:       JSON.stringify(body.images ?? []),
          unit:         body.unit         ?? null,
          unitQuantity: body.unitQuantity ?? null,
          isVeg:        body.isVeg        ?? null,
          isFeatured:   body.isFeatured   ?? false,
          isPopular:    body.isPopular    ?? false,
          preparationTime: body.preparationTime ?? null,
          minOrderQty:  body.minOrderQty  ?? 1,
          maxOrderQty:  body.maxOrderQty  ?? 100,
          tags:         JSON.stringify(body.tags ?? []),
          workflowType: body.workflowType ?? null,
          sortOrder:    body.sortOrder    ?? 0,
          metadata:     JSON.stringify(body.metadata ?? {}),
          variants: variants.length > 0
            ? {
                create: variants.map((v: Record<string, unknown>, i: number) => ({
                  name:           String(v.name || name),
                  sku:            v.sku     ? String(v.sku)     : null,
                  barcode:        v.barcode ? String(v.barcode) : null,
                  price:          Number(v.price) || 0,
                  mrp:            Number(v.mrp)   || Number(v.price) || 0,
                  costPrice:      v.costPrice ? Number(v.costPrice) : null,
                  discountPrice:  v.discountPrice  ? Number(v.discountPrice)  : null,
                  discountPercent: v.discountPercent ? Number(v.discountPercent) : null,
                  isDefault:      i === 0,
                  isActive:       true,
                  attributes:     JSON.stringify(v.attributes ?? {}),
                })),
              }
            : {
                create: {
                  name:      name,
                  price:     Number(body.price) || 0,
                  mrp:       Number(body.mrp)   || Number(body.price) || 0,
                  isDefault: true,
                  isActive:  true,
                  attributes: '{}',
                },
              },
        },
        include: { variants: true },
      })

      // Wire inventory for each variant if storeId is provided
      const pWithVariants = p as typeof p & { variants: Array<{ id: string }> }
      if (storeId) {
        for (let i = 0; i < pWithVariants.variants.length; i++) {
          const v   = pWithVariants.variants[i]
          const qty = Number(variants[i]?.stock ?? body.stock ?? 0)
          await tx.inventory.create({
            data: {
              businessId,
              storeId,
              productId: p.id,
              variantId: v.id,
              quantity:  qty,
              minStock:  10,
              maxStock:  1000,
              status:    qty > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK',
            },
          })
        }
      }

      return p
    })

    return NextResponse.json({ success: true, data: product }, { status: 201 })
  } catch (error) {
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to create product',
      500,
    )
  }
})
