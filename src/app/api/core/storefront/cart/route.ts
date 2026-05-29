// ============================================================================
// GET    /api/core/storefront/cart?storeId=X  — Get customer cart
// POST   /api/core/storefront/cart            — Add item to cart
// PATCH  /api/core/storefront/cart            — Update item quantity
// DELETE /api/core/storefront/cart?itemId=X   — Remove item (or ?clear=true to clear all)
// Auth required (CUSTOMER role)
// ============================================================================

import { NextResponse } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'

async function resolveCustomer(userId: string, businessId: string) {
  return db.customer.findFirst({ where: { userId, businessId } })
}

export const GET = withMiddleware({ requireAuth: true })(
  async (req) => {
    try {
      const user = req.user!
      const businessId = user.businessId!
      const { searchParams } = new URL(req.url)
      const storeId = searchParams.get('storeId') ?? undefined

      const customer = await resolveCustomer(user.id, businessId)
      if (!customer) return NextResponse.json({ success: true, data: [], total: 0 })

      const where: Record<string, unknown> = { customerId: customer.id, businessId }
      if (storeId) where.storeId = storeId

      const items = await db.cartItem.findMany({
        where,
        include: {
          product: {
            select: {
              id: true, name: true, slug: true, images: true, status: true,
              variants: { where: { isActive: true }, select: { id: true, name: true, price: true, mrp: true, discountPrice: true, sku: true, barcode: true, isDefault: true } },
              inventory: storeId ? { where: { storeId }, select: { quantity: true, reservedQty: true, status: true } } : undefined,
            },
          },
        },
        orderBy: { addedAt: 'desc' },
      })

      const enriched = items.map(item => {
        const variant = item.product.variants.find(v => v.id === item.variantId)
          ?? item.product.variants.find(v => v.isDefault)
          ?? item.product.variants[0]
        const unitPrice = variant
          ? (variant.discountPrice != null && variant.discountPrice < variant.price ? variant.discountPrice : variant.price)
          : 0
        const inv = (item.product.inventory as Array<{ quantity: number; reservedQty: number; status: string }> | undefined)?.[0]
        return {
          id: item.id,
          productId: item.productId,
          variantId: item.variantId,
          storeId: item.storeId,
          quantity: item.quantity,
          product: {
            name: item.product.name,
            slug: item.product.slug,
            images: JSON.parse(item.product.images || '[]') as string[],
            status: item.product.status,
          },
          variant: variant ? { id: variant.id, name: variant.name, price: variant.price, mrp: variant.mrp, discountPrice: variant.discountPrice, sku: variant.sku } : null,
          unitPrice,
          lineTotal: unitPrice * item.quantity,
          availableQty: inv ? Math.max(0, inv.quantity - inv.reservedQty) : null,
          inventoryStatus: inv?.status ?? null,
        }
      })

      const total = enriched.reduce((s, i) => s + i.lineTotal, 0)
      return NextResponse.json({ success: true, data: enriched, total: Math.round(total * 100) / 100, itemCount: enriched.length })
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : 'Failed to get cart', 500)
    }
  },
)

export const POST = withMiddleware({ requireAuth: true })(
  async (req) => {
    try {
      const user = req.user!
      const businessId = user.businessId!
      const body = await req.json()
      const { productId, variantId, storeId, quantity = 1 } = body

      if (!productId) return createErrorResponse('productId is required', 400)
      if (!storeId) return createErrorResponse('storeId is required', 400)
      if (quantity <= 0) return createErrorResponse('quantity must be positive', 400)

      const customer = await resolveCustomer(user.id, businessId)
      if (!customer) return createErrorResponse('Customer profile not found', 404)

      const product = await db.product.findFirst({
        where: { id: productId, businessId, status: 'ACTIVE' },
      })
      if (!product) return createErrorResponse('Product not found or inactive', 404)

      const existing = await db.cartItem.findFirst({
        where: { customerId: customer.id, storeId, productId, variantId: variantId ?? null },
      })

      let item
      if (existing) {
        item = await db.cartItem.update({
          where: { id: existing.id },
          data: { quantity: existing.quantity + quantity },
        })
      } else {
        item = await db.cartItem.create({
          data: { businessId, customerId: customer.id, storeId, productId, variantId: variantId ?? null, quantity },
        })
      }

      return NextResponse.json({ success: true, data: item }, { status: 201 })
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : 'Failed to add to cart', 500)
    }
  },
)

export const PATCH = withMiddleware({ requireAuth: true })(
  async (req) => {
    try {
      const user = req.user!
      const businessId = user.businessId!
      const body = await req.json()
      const { itemId, quantity } = body

      if (!itemId) return createErrorResponse('itemId is required', 400)
      if (quantity === undefined || quantity < 0) return createErrorResponse('quantity must be >= 0', 400)

      const customer = await resolveCustomer(user.id, businessId)
      if (!customer) return createErrorResponse('Customer profile not found', 404)

      const existing = await db.cartItem.findFirst({ where: { id: itemId, customerId: customer.id } })
      if (!existing) return createErrorResponse('Cart item not found', 404)

      if (quantity === 0) {
        await db.cartItem.delete({ where: { id: itemId } })
        return NextResponse.json({ success: true, message: 'Item removed from cart' })
      }

      const updated = await db.cartItem.update({ where: { id: itemId }, data: { quantity } })
      return NextResponse.json({ success: true, data: updated })
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : 'Failed to update cart', 500)
    }
  },
)

export const DELETE = withMiddleware({ requireAuth: true })(
  async (req) => {
    try {
      const user = req.user!
      const businessId = user.businessId!
      const { searchParams } = new URL(req.url)
      const itemId = searchParams.get('itemId')
      const clear = searchParams.get('clear') === 'true'
      const storeId = searchParams.get('storeId') ?? undefined

      const customer = await resolveCustomer(user.id, businessId)
      if (!customer) return createErrorResponse('Customer profile not found', 404)

      if (clear) {
        const where: Record<string, unknown> = { customerId: customer.id, businessId }
        if (storeId) where.storeId = storeId
        await db.cartItem.deleteMany({ where })
        return NextResponse.json({ success: true, message: 'Cart cleared' })
      }

      if (!itemId) return createErrorResponse('itemId query param is required', 400)

      const existing = await db.cartItem.findFirst({ where: { id: itemId, customerId: customer.id } })
      if (!existing) return createErrorResponse('Cart item not found', 404)

      await db.cartItem.delete({ where: { id: itemId } })
      return NextResponse.json({ success: true, message: 'Item removed from cart' })
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : 'Failed to remove from cart', 500)
    }
  },
)
