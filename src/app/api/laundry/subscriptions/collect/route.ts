// POST /api/laundry/subscriptions/collect
//
// Collect a payment against a PENDING subscription purchase (cash / UPI / card /
// link). Reuses applyPaymentToPurchase — the subscription ACTIVATES automatically
// once fully paid (issuing the membership ID + allowance). No manual "Activate".
// Online (Razorpay) is not wired yet and is blocked by the UI ("Coming Soon").
//
// Body: { businessId, purchaseId, amount, method }
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { applyPaymentToPurchase } from "@/lib/laundry-subscription-purchase"

export const runtime = "nodejs"

const METHODS = ["CASH", "UPI", "CARD", "LINK", "BANK", "OTHER"]

export async function POST(request: Request) {
  try {
    const { businessId, purchaseId, amount, method } = (await request.json().catch(() => ({}))) as { businessId?: string; purchaseId?: string; amount?: number; method?: string }
    if (!businessId || !purchaseId) return NextResponse.json({ success: false, error: "businessId and purchaseId are required" }, { status: 400 })
    const guard = await requireLaundryPermission(request, businessId, "store_ops.payment_collection.operate")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz?.platformBusinessId) return NextResponse.json({ success: false, error: "Laundry business not found" }, { status: 404 })

    const purchase = await prisma.subscriptionPurchase.findFirst({ where: { id: purchaseId, businessId: biz.platformBusinessId }, select: { id: true, amount: true, amountPaid: true, status: true } })
    if (!purchase) return NextResponse.json({ success: false, error: "Subscription request not found" }, { status: 404 })
    if (purchase.status === "ACTIVATED") return NextResponse.json({ success: false, error: "This subscription is already paid and active." }, { status: 409 })

    const outstanding = Math.max(0, purchase.amount - purchase.amountPaid)
    const pay = Math.min(Math.max(0, Number(amount) || outstanding), outstanding) // default = full due
    const m = (method || "CASH").toUpperCase()
    if (!METHODS.includes(m)) return NextResponse.json({ success: false, error: "Invalid payment method" }, { status: 400 })

    const res = await applyPaymentToPurchase(purchaseId, pay)
    if (res.error) return NextResponse.json({ success: false, error: res.error }, { status: 400 })
    // Record how the money came in (frozen apply fn tracks amount/status only).
    await prisma.subscriptionPurchase.update({ where: { id: purchaseId }, data: { paymentMethod: m } }).catch(() => {})

    let membershipId: string | null = null
    if (res.activated && res.subscriptionId) {
      membershipId = (await prisma.customerSubscription.findUnique({ where: { id: res.subscriptionId }, select: { membershipId: true } }))?.membershipId ?? null
    }
    return NextResponse.json({ success: true, applied: res.applied, activated: !!res.activated, subscriptionId: res.subscriptionId ?? null, membershipId, remaining: res.remaining ?? 0 })
  } catch (e) {
    console.error("[laundry-subscription/collect] POST", e)
    return NextResponse.json({ success: false, error: "Payment collection failed" }, { status: 500 })
  }
}
