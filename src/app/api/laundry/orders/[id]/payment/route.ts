// GET  /api/laundry/orders/[id]/payment — combined customer dues for the order
//        (laundry order charges + any linked pending subscription purchase).
// POST /api/laundry/orders/[id]/payment — record a payment, allocated across the
//        order first, then the linked subscription purchase. Supports partial.
//        The subscription (allowance) activates only when its due is FULLY paid.
//
// Body: { businessId, method, amount, reference?, note?, createdBy? }
//   method: CASH | UPI | CARD | WALLET | CREDIT | SUBSCRIPTION | PARTIAL
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { applyPaymentToPurchase } from "@/lib/laundry-subscription-purchase"

export const runtime = "nodejs"

const METHODS = new Set(["CASH", "UPI", "CARD", "WALLET", "CREDIT", "SUBSCRIPTION", "PARTIAL"])
const r2 = (n: number) => Math.round(n * 100) / 100

async function loadDues(orderId: string, lbId: string, platformId: string | null) {
  const order = await prisma.laundryOrder.findFirst({ where: { id: orderId, businessId: lbId }, select: { id: true, orderNumber: true, grandTotal: true, amountPaid: true, customerId: true } })
  if (!order) return null
  // A pending subscription purchase collected with this order.
  const purchase = order.customerId
    ? await prisma.subscriptionPurchase.findFirst({ where: { laundryOrderId: order.id, status: { in: ["INITIATED", "PAYMENT_PENDING"] } } })
    : null
  let planName: string | null = null
  if (purchase) { const p = await prisma.subscriptionPlan.findUnique({ where: { id: purchase.planId }, select: { name: true } }); planName = p?.name || null }
  const orderDue = r2(Math.max(0, order.grandTotal - order.amountPaid))
  const subDue = purchase ? r2(Math.max(0, purchase.amount - purchase.amountPaid)) : 0
  return { order, purchase, planName, orderDue, subDue, totalDue: r2(orderDue + subDue) }
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const businessId = new URL(request.url).searchParams.get("businessId")
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })
    const d = await loadDues(id, biz.id, biz.platformBusinessId)
    if (!d) return NextResponse.json({ error: "Order not found" }, { status: 404 })
    return NextResponse.json({ success: true, data: {
      laundryCharges: r2(d.order.grandTotal), laundryPaid: r2(d.order.amountPaid), laundryDue: d.orderDue,
      subscription: d.purchase ? { purchaseId: d.purchase.id, planName: d.planName, amount: d.purchase.amount, paid: d.purchase.amountPaid, due: d.subDue, status: "PAYMENT_PENDING" } : null,
      totalCustomerDue: d.totalDue,
    } })
  } catch (e) {
    console.error("[laundry-order-payment] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { businessId, method, amount, reference, note, createdBy } = body

    if (!businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
    if (!method || !METHODS.has(method)) return NextResponse.json({ error: "Invalid payment method" }, { status: 400 })
    const amt = Number(amount)
    if (!Number.isFinite(amt) || amt <= 0) return NextResponse.json({ error: "Amount must be greater than zero" }, { status: 400 })

    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })

    const d = await loadDues(id, biz.id, biz.platformBusinessId)
    if (!d) return NextResponse.json({ error: "Order not found" }, { status: 404 })

    // Allocation priority: laundry order charges first, then subscription due.
    const toOrder = Math.min(amt, d.orderDue)
    const toSubscription = r2(Math.min(amt - toOrder, d.subDue))

    const newPaid = r2(d.order.amountPaid + toOrder)
    const balanceDue = r2(Math.max(0, d.order.grandTotal - newPaid))
    const paymentStatus = newPaid <= 0 ? "UNPAID" : balanceDue <= 0 ? "PAID" : "PARTIAL"

    const [, updated] = await prisma.$transaction([
      prisma.laundryPayment.create({ data: { orderId: d.order.id, businessId: biz.id, method, amount: amt, reference: reference || null, note: note || `Allocated ₹${toOrder} order + ₹${toSubscription} subscription`, createdBy: createdBy || null } }),
      prisma.laundryOrder.update({ where: { id: d.order.id }, data: { amountPaid: newPaid, balanceDue, paymentStatus }, include: { payments: { orderBy: { createdAt: "desc" } } } }),
    ])

    // Apply the subscription portion (activates the allowance only when fully paid).
    let subscriptionResult: Record<string, unknown> | null = null
    if (d.purchase && toSubscription > 0) {
      const ap = await applyPaymentToPurchase(d.purchase.id, toSubscription)
      subscriptionResult = { purchaseId: d.purchase.id, applied: ap.applied, activated: ap.activated, subscriptionId: ap.subscriptionId, remaining: ap.remaining ?? d.subDue - toSubscription }
    } else if (d.purchase) {
      subscriptionResult = { purchaseId: d.purchase.id, applied: 0, activated: false, remaining: d.subDue }
    }

    return NextResponse.json({ success: true, data: {
      order: updated,
      allocation: { toLaundryOrder: r2(toOrder), toSubscription },
      subscription: subscriptionResult,
    } }, { status: 201 })
  } catch (e) {
    console.error("[laundry-order-payment] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
