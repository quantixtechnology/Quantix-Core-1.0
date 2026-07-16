// GET /api/core/storefront/laundry-orders  — the authenticated customer's placed
// LaundryOrders (My Orders). The Commerce Orders API queries the `Order` model
// only; laundry orders live in `LaundryOrder`, so they need their own customer-
// facing query. Tenant + ownership scoped: only the resolving customer's orders.
import { NextResponse } from "next/server"
import { withMiddleware } from "@/lib/middleware"
import { db } from "@/lib/db"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { normalizePhone } from "@/lib/customer-identity"
import { statusLabel } from "@/lib/laundry-workflow"

async function resolveCustomerId(userId: string, businessId: string): Promise<string[]> {
  const userRec = await db.user.findUnique({ where: { id: userId }, select: { phone: true } })
  const norm = userRec?.phone ? normalizePhone(userRec.phone) : null
  const rows = await db.customer.findMany({
    where: { businessId, OR: [{ userId }, ...(norm ? [{ phone: norm }, { phone: userRec!.phone! }] : [])] },
    select: { id: true },
  })
  return rows.map((r) => r.id)
}

export const GET = withMiddleware({ requireAuth: true, requiredRoles: ["CUSTOMER"] })(async (req) => {
  try {
    const user = req.user!
    const platformId = user.businessId!
    const biz = await resolveLaundryBusiness(platformId)
    if (!biz) return NextResponse.json({ success: true, data: [] })
    const lbId = biz.id

    const customerIds = await resolveCustomerId(user.id, platformId)
    if (customerIds.length === 0) return NextResponse.json({ success: true, data: [] })

    const orders = await db.laundryOrder.findMany({
      where: { businessId: lbId, customerId: { in: customerIds } },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true, orderNumber: true, status: true, orderType: true, paymentStatus: true,
        grandTotal: true, amountPaid: true, balanceDue: true, pickupDate: true, pickupTimeSlot: true,
        pickupAddress: true, createdAt: true,
        store: { select: { storeName: true } },
        items: { select: { serviceName: true, garmentName: true, quantity: true } },
      },
    })

    const data = orders.map((o) => {
      // Group garment items by service for a laundry-native summary.
      const byService = new Map<string, number>()
      for (const it of o.items) byService.set(it.serviceName, (byService.get(it.serviceName) || 0) + (it.quantity || 0))
      return {
        id: o.id, orderNumber: o.orderNumber, status: o.status, statusLabel: statusLabel(o.status), orderType: o.orderType,
        paymentStatus: o.paymentStatus, grandTotal: o.grandTotal, amountPaid: o.amountPaid, balanceDue: o.balanceDue,
        pickupDate: o.pickupDate, pickupTimeSlot: o.pickupTimeSlot, pickupAddress: o.pickupAddress, createdAt: o.createdAt,
        storeName: o.store?.storeName ?? null,
        services: [...byService.entries()].map(([service, garments]) => ({ service, garments })),
        totalGarments: o.items.reduce((s, it) => s + (it.quantity || 0), 0),
      }
    })
    return NextResponse.json({ success: true, data })
  } catch (e) {
    console.error("[laundry-orders] GET", e)
    return NextResponse.json({ success: false, error: "Failed to load orders" }, { status: 500 })
  }
})
