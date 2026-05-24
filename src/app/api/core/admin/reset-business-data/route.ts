// ============================================================================
// QUANTIX CORE — Business Data Reset
// POST /api/core/admin/reset-business-data
//
// Deletes ALL transactional data (orders, customers) for a given business
// while preserving the entire product catalog, categories, inventory,
// stores, settings, and business configuration.
//
// BYPASS: localhost / loopback / NODE_ENV=development — no auth required.
// PRODUCTION: requires QUANTIX_SUPER_ADMIN role.
//
// DELETE AFTER MIGRATION — remove this file once the reset is complete.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { withMiddleware } from '@/lib/middleware'
import { db } from '@/lib/db'
import { generateCustomerCode } from '@/lib/customer-code'

function isLocalRequest(req: NextRequest): boolean {
  const host = req.headers.get('host') || ''
  const forwarded = req.headers.get('x-forwarded-for') || ''
  const realIp = req.headers.get('x-real-ip') || ''
  const isLocalHost = host.startsWith('localhost') || host.startsWith('127.0.0.1')
  const isLoopback =
    forwarded.startsWith('127.') || forwarded.startsWith('::1') ||
    realIp.startsWith('127.') || realIp === '::1'
  return isLocalHost || isLoopback || process.env.NODE_ENV === 'development'
}

async function count(table: string, bid: string): Promise<number> {
  const result = await db.$queryRawUnsafe<[{ n: number }]>(
    `SELECT COUNT(*) as n FROM "${table}" WHERE businessId = ?`, bid,
  )
  return Number(result[0]?.n ?? 0)
}

async function handler(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    businessCode?: string
    businessId?: string
    confirm?: boolean
  }

  if (!body.confirm) {
    return NextResponse.json({
      success: false,
      error: 'Pass confirm: true to execute. This is irreversible.',
    }, { status: 400 })
  }

  // ── Resolve business ────────────────────────────────────────────────────────
  let business: { id: string; name: string } | null = null

  if (body.businessId) {
    business = await db.business.findUnique({
      where: { id: body.businessId },
      select: { id: true, name: true },
    })
  } else if (body.businessCode) {
    // businessCode is stored as slug-adjacent field; find by slug pattern
    // The businessCode format is BUS-YYYYMM-NNNN; stored in Business.businessCode
    business = await db.business.findFirst({
      where: { slug: { contains: body.businessCode.toLowerCase().replace(/-/g, '') } },
      select: { id: true, name: true },
    })
    // Fallback: search by name match from businessCode
    if (!business) {
      // businessCode like BUS-202605-0001 → find by checking all businesses
      const all = await db.business.findMany({ select: { id: true, name: true } })
      // Since businessCode column doesn't exist in this schema version,
      // caller must provide businessId directly if businessCode lookup fails
      if (all.length === 1) business = all[0]
    }
  }

  if (!business) {
    return NextResponse.json({
      success: false,
      error: 'Business not found. Provide businessId directly.',
    }, { status: 404 })
  }

  const businessId = business.id

  // ── Pre-reset counts ────────────────────────────────────────────────────────
  const before = {
    orders:       await count('Order',               businessId),
    customers:    await count('Customer',            businessId),
    notifications:await count('Notification',        businessId),
    reviews:      await count('Review',              businessId),
    supportTickets: await count('SupportTicket',     businessId),
    products:     await count('Product',             businessId),
    categories:   await count('Category',            businessId),
    inventory:    await db.inventory.count({ where: { product: { businessId } } }),
    stores:       await count('Store',               businessId),
  }

  // ── DELETION (FK-safe order) ────────────────────────────────────────────────
  const deleted: Record<string, number> = {}

  const d = async (label: string, fn: () => Promise<{ count: number }>) => {
    const r = await fn()
    deleted[label] = r.count
  }

  // 1. Payment (FK → Order)
  await d('Payment', () => db.payment.deleteMany({ where: { businessId } }))

  // 2. OrderItem (FK → Order)
  const orderIds = (await db.order.findMany({ where: { businessId }, select: { id: true } })).map(o => o.id)
  await d('OrderItem', () => db.orderItem.deleteMany({ where: { orderId: { in: orderIds } } }))

  // 3. OrderStatusHistory (FK → Order)
  await d('OrderStatusHistory', () => db.orderStatusHistory.deleteMany({ where: { orderId: { in: orderIds } } }))

  // 4. Delivery (FK → Order, cascade — but explicit for count)
  await d('Delivery', () => db.delivery.deleteMany({ where: { orderId: { in: orderIds } } }))

  // 5. Invoice (FK → Order nullable, FK → Customer nullable, FK → Business)
  await d('Invoice', () => db.invoice.deleteMany({ where: { businessId } }))

  // 6. Review (FK → Customer + Business)
  await d('Review', () => db.review.deleteMany({ where: { businessId } }))

  // 7. SupportTicket (FK → Customer SetNull + Business)
  await d('SupportTicket', () => db.supportTicket.deleteMany({ where: { businessId } }))

  // 8. CartItem (FK → Customer + Business)
  await d('CartItem', () => db.cartItem.deleteMany({ where: { businessId } }))

  // 9. Favorite (FK → Customer + Business)
  await d('Favorite', () => db.favorite.deleteMany({ where: { businessId } }))

  // 10. CustomerSubscription (FK → Customer + Business)
  await d('CustomerSubscription', () => db.customerSubscription.deleteMany({ where: { businessId } }))

  // 11. CustomerNote (FK → Customer)
  const customerIds = (await db.customer.findMany({ where: { businessId }, select: { id: true } })).map(c => c.id)
  await d('CustomerNote', () => db.customerNote.deleteMany({ where: { customerId: { in: customerIds } } }))

  // 12. Address (FK → Customer, cascade — but explicit for count)
  await d('Address', () => db.address.deleteMany({ where: { customerId: { in: customerIds } } }))

  // 13. Order
  await d('Order', () => db.order.deleteMany({ where: { businessId } }))

  // 14. Customer
  await d('Customer', () => db.customer.deleteMany({ where: { businessId } }))

  // 15. Notifications linked to orders/customers (business-scoped)
  await d('Notification', () => db.notification.deleteMany({ where: { businessId } }))

  // ── Post-reset validation ───────────────────────────────────────────────────
  const after = {
    orders:     await count('Order',    businessId),
    customers:  await count('Customer', businessId),
    products:   await count('Product',  businessId),
    categories: await count('Category', businessId),
    inventory:  await db.inventory.count({ where: { product: { businessId } } }),
    stores:     await count('Store',    businessId),
  }

  // ── Next codes (sequence preview) ──────────────────────────────────────────
  const nextCustomerCode = await generateCustomerCode(businessId)

  const today = new Date()
  const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`
  const nextOrderCode = `ORD-${dateStr}-001`

  return NextResponse.json({
    success: true,
    business: { id: businessId, name: business.name },
    before,
    deleted,
    after,
    validation: {
      ordersCleared:    after.orders    === 0,
      customersCleared: after.customers === 0,
      productsIntact:   after.products  === before.products,
      categoriesIntact: after.categories === before.categories,
      inventoryIntact:  after.inventory  === before.inventory,
      storesIntact:     after.stores     === before.stores,
    },
    nextCodes: {
      customer: nextCustomerCode,
      order:    nextOrderCode,
    },
  })
}

export const POST = (req: NextRequest) => {
  if (isLocalRequest(req)) return handler(req)
  return withMiddleware({ requireAuth: true, requiredRoles: ['QUANTIX_SUPER_ADMIN'] })(handler)(req)
}
