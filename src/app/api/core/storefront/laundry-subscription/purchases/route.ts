// GET /api/core/storefront/laundry-subscription/purchases
// The authenticated customer's subscription purchase history (plan, amount,
// payment status, reference, dates) for their account/order history view.
import { NextResponse } from "next/server"
import { withMiddleware } from "@/lib/middleware"
import { db } from "@/lib/db"
import { listSubscriptionPurchases } from "@/lib/laundry-subscription-purchase"

async function resolveCustomer(userId: string, businessId: string, phone?: string | null) {
  const byUser = await db.customer.findFirst({ where: { userId, businessId } })
  if (byUser) return byUser
  if (phone) return db.customer.findFirst({ where: { businessId, phone, userId: null } })
  return null
}

export const GET = withMiddleware({ requireAuth: true, requiredRoles: ["CUSTOMER"] })(async (req) => {
  try {
    const user = req.user!
    const businessId = user.businessId!
    const userRecord = await db.user.findUnique({ where: { id: user.id }, select: { phone: true } })
    const customer = await resolveCustomer(user.id, businessId, userRecord?.phone)
    if (!customer) return NextResponse.json({ success: true, data: [] })
    return NextResponse.json({ success: true, data: await listSubscriptionPurchases(businessId, customer.id) })
  } catch (e) {
    console.error("[laundry-sub-purchases] GET", e)
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 })
  }
})
