// ============================================================================
// GET    /api/core/storefront/favorites            — List customer favorites
// POST   /api/core/storefront/favorites            — Add product to favorites
// DELETE /api/core/storefront/favorites?productId=X — Remove from favorites
// Auth required (CUSTOMER role)
// ============================================================================

import { NextResponse } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'
async function resolveCustomer(userId: string, businessId: string) {
  return db.customer.findFirst({ where: { userId, businessId } })
}

export const GET = withMiddleware({ requireAuth: true, requiredRoles: ['CUSTOMER'] })(
  async (req) => {
    try {
      const user = req.user!
      const businessId = user.businessId!

      const customer = await resolveCustomer(user.id, businessId)
      if (!customer) return NextResponse.json({ success: true, data: [] })

      const favorites = await db.favorite.findMany({
        where: { customerId: customer.id, businessId },
        include: {
          product: {
            select: {
              id: true, name: true, slug: true, images: true, status: true, isFeatured: true, isPopular: true,
              variants: {
                where: { isActive: true, isDefault: true },
                select: { id: true, name: true, price: true, mrp: true, discountPrice: true, discountPercent: true },
                take: 1,
              },
              category: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { addedAt: 'desc' },
      })

      const data = favorites.map(f => {
        const variant = f.product.variants[0]
        return {
          id: f.id,
          productId: f.productId,
          addedAt: f.addedAt,
          product: {
            name: f.product.name,
            slug: f.product.slug,
            images: JSON.parse(f.product.images || '[]') as string[],
            status: f.product.status,
            category: f.product.category,
            price: variant?.price ?? null,
            mrp: variant?.mrp ?? null,
            discountPrice: variant?.discountPrice ?? null,
            discountPercent: variant?.discountPercent ?? null,
          },
        }
      })

      return NextResponse.json({ success: true, data, total: data.length })
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : 'Failed to get favorites', 500)
    }
  },
)

export const POST = withMiddleware({ requireAuth: true, requiredRoles: ['CUSTOMER'] })(
  async (req) => {
    try {
      const user = req.user!
      const businessId = user.businessId!
      const body = await req.json()
      const { productId } = body

      if (!productId) return createErrorResponse('productId is required', 400)

      const customer = await resolveCustomer(user.id, businessId)
      if (!customer) return createErrorResponse('Customer profile not found', 404)

      const product = await db.product.findFirst({ where: { id: productId, businessId } })
      if (!product) return createErrorResponse('Product not found', 404)

      const existing = await db.favorite.findFirst({ where: { customerId: customer.id, productId } })
      if (existing) return NextResponse.json({ success: true, data: existing, message: 'Already in favorites' })

      const favorite = await db.favorite.create({
        data: { businessId, customerId: customer.id, productId },
      })

      return NextResponse.json({ success: true, data: favorite }, { status: 201 })
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : 'Failed to add favorite', 500)
    }
  },
)

export const DELETE = withMiddleware({ requireAuth: true, requiredRoles: ['CUSTOMER'] })(
  async (req) => {
    try {
      const user = req.user!
      const businessId = user.businessId!
      const { searchParams } = new URL(req.url)
      const productId = searchParams.get('productId')

      if (!productId) return createErrorResponse('productId query param is required', 400)

      const customer = await resolveCustomer(user.id, businessId)
      if (!customer) return createErrorResponse('Customer profile not found', 404)

      const existing = await db.favorite.findFirst({ where: { customerId: customer.id, productId, businessId } })
      if (!existing) return createErrorResponse('Favorite not found', 404)

      await db.favorite.delete({ where: { id: existing.id } })
      return NextResponse.json({ success: true, message: 'Removed from favorites' })
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : 'Failed to remove favorite', 500)
    }
  },
)
