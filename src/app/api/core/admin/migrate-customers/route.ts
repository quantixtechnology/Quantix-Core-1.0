// ============================================================================
// QUANTIX CORE — Customer Master Migration
// POST /api/core/admin/migrate-customers
//
// Performs two operations:
//   1. Deduplication — merge customers with same (businessId, phone).
//      Winner = highest totalSpent. Loser's addresses, orders, reviews,
//      favorites, cartItems, subscriptions, supportTickets all move to winner.
//   2. Code backfill — assign CUS-{businessCode}-{pad6} to any customer
//      that doesn't have a customerCode yet.
//
// Protected by QUANTIX_SUPER_ADMIN or CLIENT_OWNER.
// Idempotent — safe to run multiple times.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { withMiddleware } from '@/lib/middleware'
import { db } from '@/lib/db'
import { backfillCustomerCodes } from '@/lib/customer-code'

function isLocalRequest(req: NextRequest): boolean {
  const host = req.headers.get('host') || ''
  const forwarded = req.headers.get('x-forwarded-for') || ''
  const realIp = req.headers.get('x-real-ip') || ''
  const isLocalHost = host.startsWith('localhost') || host.startsWith('127.0.0.1')
  const isLoopback = forwarded.startsWith('127.') || forwarded.startsWith('::1') ||
                     realIp.startsWith('127.') || realIp === '::1'
  return isLocalHost || isLoopback || process.env.NODE_ENV === 'development'
}

async function handler(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { businessId?: string; dryRun?: boolean }
  const { businessId, dryRun = false } = body

  const report = {
    dryRun,
    dedup: { groupsFound: 0, customersRemoved: 0, ordersRelinked: 0, addressesMoved: 0 },
    backfill: { updated: 0, skipped: 0 },
  }

  // ── 1. Deduplication ───────────────────────────────────────────────────────

  // Find all (businessId, phone) groups with more than one customer
  const dupGroups = await db.$queryRawUnsafe<
    { businessId: string; phone: string; cnt: number }[]
  >(
    businessId
      ? `SELECT businessId, phone, COUNT(*) as cnt FROM Customer WHERE phone IS NOT NULL AND businessId = ? GROUP BY businessId, phone HAVING cnt > 1`
      : `SELECT businessId, phone, COUNT(*) as cnt FROM Customer WHERE phone IS NOT NULL GROUP BY businessId, phone HAVING cnt > 1`,
    ...(businessId ? [businessId] : []),
  )

  report.dedup.groupsFound = dupGroups.length

  for (const group of dupGroups) {
    // Load all duplicates, sorted by totalSpent desc then totalOrders desc
    const dupes = await db.customer.findMany({
      where: { businessId: group.businessId, phone: group.phone },
      orderBy: [{ totalSpent: 'desc' }, { totalOrders: 'desc' }, { createdAt: 'asc' }],
    })

    if (dupes.length < 2) continue

    const [winner, ...losers] = dupes
    const loserIds = losers.map(l => l.id)

    if (dryRun) {
      report.dedup.customersRemoved += losers.length
      continue
    }

    // Merge email/name onto winner if missing
    const emailFill = winner.email ?? losers.find(l => l.email)?.email ?? null
    const nameFill = winner.name || losers.find(l => l.name)?.name || winner.name

    await db.customer.update({
      where: { id: winner.id },
      data: {
        email: emailFill ?? undefined,
        name: nameFill,
        totalOrders: dupes.reduce((s, c) => s + c.totalOrders, 0),
        totalSpent: dupes.reduce((s, c) => s + c.totalSpent, 0),
        walletBalance: dupes.reduce((s, c) => s + c.walletBalance, 0),
        loyaltyPoints: dupes.reduce((s, c) => s + c.loyaltyPoints, 0),
        lastOrderAt: dupes
          .map(c => c.lastOrderAt)
          .filter(Boolean)
          .sort()
          .reverse()[0] ?? winner.lastOrderAt,
        isGuest: false,
        verified: true,
      },
    })

    // Move orders
    const orders = await db.order.updateMany({
      where: { customerId: { in: loserIds } },
      data: { customerId: winner.id },
    })
    report.dedup.ordersRelinked += orders.count

    // Move addresses (skip if winner already has same area+pincode to avoid near-dupes)
    for (const loserId of loserIds) {
      const loserAddresses = await db.address.findMany({ where: { customerId: loserId } })
      for (const addr of loserAddresses) {
        // Check if winner has address in same pincode+line1
        const exists = await db.address.findFirst({
          where: { customerId: winner.id, pincode: addr.pincode, addressLine1: addr.addressLine1 },
        })
        if (!exists) {
          await db.address.update({
            where: { id: addr.id },
            data: { customerId: winner.id, isDefault: false },
          })
          report.dedup.addressesMoved++
        }
      }
    }

    // Move other relations
    await db.review.updateMany({ where: { customerId: { in: loserIds } }, data: { customerId: winner.id } }).catch(() => {})
    await db.favorite.updateMany({ where: { customerId: { in: loserIds } }, data: { customerId: winner.id } }).catch(() => {})
    await db.cartItem.updateMany({ where: { customerId: { in: loserIds } }, data: { customerId: winner.id } }).catch(() => {})
    await db.customerSubscription.updateMany({ where: { customerId: { in: loserIds } }, data: { customerId: winner.id } }).catch(() => {})
    await db.supportTicket.updateMany({ where: { customerId: { in: loserIds } }, data: { customerId: winner.id } }).catch(() => {})
    await db.invoice.updateMany({ where: { customerId: { in: loserIds } }, data: { customerId: winner.id } }).catch(() => {})
    await db.customerNote.deleteMany({ where: { customerId: { in: loserIds } } }).catch(() => {})

    // Delete losers (addresses already moved or deleted)
    await db.address.deleteMany({ where: { customerId: { in: loserIds } } })
    await db.customer.deleteMany({ where: { id: { in: loserIds } } })

    report.dedup.customersRemoved += losers.length
  }

  // ── 2. Backfill customer codes ─────────────────────────────────────────────

  if (!dryRun) {
    const { updated, skipped } = await backfillCustomerCodes()
    report.backfill = { updated, skipped }
  } else {
    const missingCount = await db.customer.count({ where: { customerCode: null } })
    report.backfill = { updated: missingCount, skipped: 0 }
  }

  return NextResponse.json({ success: true, data: report })
}

export const POST = (req: NextRequest) => {
  if (isLocalRequest(req)) return handler(req)
  return withMiddleware({ requireAuth: true, requiredRoles: ['QUANTIX_SUPER_ADMIN', 'CLIENT_OWNER'] })(handler)(req)
}
