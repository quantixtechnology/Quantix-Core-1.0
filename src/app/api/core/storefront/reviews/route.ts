// GET  /api/core/storefront/reviews?productId=X  — list published reviews for a product
// POST /api/core/storefront/reviews               — submit a review (CUSTOMER only)
import { NextResponse } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'

async function resolveCustomer(userId: string, businessId: string) {
  return db.customer.findFirst({ where: { userId, businessId } })
}

export const GET = withMiddleware({ requireAuth: false })(
  async (req) => {
    try {
      const { searchParams } = new URL(req.url)
      const productId = searchParams.get('productId')
      const businessId = searchParams.get('businessId') || req.user?.businessId

      if (!productId) return createErrorResponse('productId is required', 400)
      if (!businessId) return createErrorResponse('businessId is required', 400)

      const reviews = await db.review.findMany({
        where: { productId, businessId, isPublished: true },
        include: {
          customer: { select: { name: true, avatar: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      })

      const data = reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        title: r.title,
        body: r.body,
        images: JSON.parse(r.images || '[]') as string[],
        isVerified: r.isVerified,
        createdAt: r.createdAt,
        customer: { name: r.customer.name, avatar: r.customer.avatar },
      }))

      const avgRating = data.length > 0
        ? data.reduce((s, r) => s + r.rating, 0) / data.length
        : 0

      return NextResponse.json({ success: true, data, total: data.length, avgRating: Math.round(avgRating * 10) / 10 })
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : 'Failed to fetch reviews', 500)
    }
  },
)

export const POST = withMiddleware({ requireAuth: true, requiredRoles: ['CUSTOMER'] })(
  async (req) => {
    try {
      const user = req.user!
      const businessId = user.businessId!
      const body = await req.json() as { productId: string; orderId?: string; rating: number; title?: string; body?: string }

      const { productId, orderId, rating, title, body: reviewBody } = body

      if (!productId) return createErrorResponse('productId is required', 400)
      if (!rating || rating < 1 || rating > 5) return createErrorResponse('rating must be 1-5', 400)

      const customer = await resolveCustomer(user.id, businessId)
      if (!customer) return createErrorResponse('Customer profile not found', 404)

      const product = await db.product.findFirst({ where: { id: productId, businessId } })
      if (!product) return createErrorResponse('Product not found', 404)

      // If orderId is provided, verify it belongs to this customer
      let isVerified = false
      if (orderId) {
        const order = await db.order.findFirst({ where: { id: orderId, customerId: customer.id, status: 'DELIVERED' } })
        isVerified = !!order
      }

      const review = await db.review.create({
        data: {
          businessId,
          customerId: customer.id,
          productId,
          orderId: orderId || null,
          rating,
          title: title || null,
          body: reviewBody || null,
          isVerified,
        },
      })

      return NextResponse.json({ success: true, data: review }, { status: 201 })
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : 'Failed to submit review', 500)
    }
  },
)
