// GET /api/core/storefront/orders/[id]/laundry-invoice
// The authenticated customer's invoice for one of THEIR laundry orders. Reuses
// the SAME invoice service (resolveInvoiceView) as the Admin endpoint — the
// customer sees exactly the same invoice. Ownership + tenant scoped.
import { NextResponse } from "next/server"
import { withMiddleware } from "@/lib/middleware"
import { db } from "@/lib/db"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { normalizePhone } from "@/lib/customer-identity"
import { resolveInvoiceView } from "@/lib/laundry-invoice"

async function resolveCustomerId(userId: string, businessId: string): Promise<string[]> {
  const userRec = await db.user.findUnique({ where: { id: userId }, select: { phone: true } })
  const norm = userRec?.phone ? normalizePhone(userRec.phone) : null
  const rows = await db.customer.findMany({
    where: { businessId, OR: [{ userId }, ...(norm ? [{ phone: norm }, { phone: userRec!.phone! }] : [])] },
    select: { id: true },
  })
  return rows.map((r) => r.id)
}

export const GET = withMiddleware({ requireAuth: true, requiredRoles: ["CUSTOMER"] })(async (req, context) => {
  try {
    const params = await context?.params
    const orderId = params?.id as string | undefined
    if (!orderId) return NextResponse.json({ success: false, error: "orderId required" }, { status: 400 })
    const user = req.user!
    const platformId = user.businessId!
    const biz = await resolveLaundryBusiness(platformId)
    if (!biz) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 })

    const customerIds = await resolveCustomerId(user.id, platformId)
    const owned = await db.laundryOrder.findFirst({
      where: { id: orderId, businessId: biz.id, customerId: { in: customerIds } },
      select: { id: true },
    })
    if (!owned) return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 })

    const view = await resolveInvoiceView(orderId)
    if (!view.ok) return NextResponse.json({ success: false, error: view.error }, { status: view.status ?? 400 })
    return NextResponse.json({ success: true, data: view.data })
  } catch (e) {
    console.error("[storefront-laundry-invoice] GET", e)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
})
