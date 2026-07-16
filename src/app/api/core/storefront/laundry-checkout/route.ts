// POST /api/core/storefront/laundry-checkout
//
// One customer checkout that may contain garments and/or a subscription plan.
// It keeps the two business entities SEPARATE:
//   • Garments  → a real LaundryOrder (normal resolved prices) that enters the
//                 operational workflow (Pending Store Audit). Never ₹0.
//   • Plan      → a pending SubscriptionPurchase (customer-level financial due),
//                 optionally linked to the order for combined collection. This
//                 does NOT create a laundry order and does NOT activate the
//                 allowance — activation happens only when the subscription is
//                 paid (at Payment Collection / online payment).
//
// A subscription bought in the SAME cart does NOT cover this order's garments
// (explicit first-order rule) — the plan applies from the NEXT order.
//
// Body: { businessId, items?: [{serviceId,garmentId,quantity}], subscriptionPlanId?,
//         customer:{name,phone,email?}, pickup?, paymentMethod?: "COD"|"ONLINE" }
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { resolveOrderBilling } from "@/lib/laundry-billing-server"
import { generateOrderNumber } from "@/lib/laundry-codes"
import { createLaundryOrder } from "@/lib/laundry-order-engine"
import { resolveOrCreateLaundryCustomer } from "@/lib/customer-identity"
import { resolvePickupAddress, type StructuredAddress } from "@/lib/laundry-address"
import { createSubscriptionPurchase } from "@/lib/laundry-subscription-purchase"

export const runtime = "nodejs"

interface Item { serviceId: string; garmentId: string; quantity: number }

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { businessId, items, subscriptionPlanId, customer, pickup, paymentMethod } = body as {
      businessId?: string; items?: Item[]; subscriptionPlanId?: string
      customer?: { name?: string; phone?: string; email?: string }
      pickup?: { address?: string; addressId?: string; structured?: StructuredAddress; date?: string; timeSlot?: string }
      paymentMethod?: "COD" | "ONLINE"
    }
    if (!businessId) return NextResponse.json({ success: false, error: "businessId is required" }, { status: 400 })
    const hasItems = Array.isArray(items) && items.length > 0
    if (!hasItems && !subscriptionPlanId) return NextResponse.json({ success: false, error: "Cart is empty" }, { status: 400 })
    if (!customer?.name || !customer?.phone) return NextResponse.json({ success: false, error: "customer name and phone are required" }, { status: 400 })

    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ success: false, error: "Laundry business not found" }, { status: 404 })
    const lbId = biz.id
    const platformId = biz.platformBusinessId || businessId
    const lb = await prisma.laundryBusiness.findUnique({ where: { id: lbId }, select: { businessCode: true } })

    // Canonical customer — shared resolver (no duplicate on phone format / channel).
    const resolved = await resolveOrCreateLaundryCustomer({
      platformBusinessId: platformId, businessCodeForCode: lb?.businessCode || `LND-${lbId}`,
      name: customer.name, phone: customer.phone, email: customer.email, customerId: (customer as { id?: string }).id,
      source: "STOREFRONT", emailRequiredForNew: true,
    })
    if (!resolved.customer) return NextResponse.json({ success: false, error: resolved.error || "Could not resolve customer" }, { status: 400 })
    const customerRow = resolved.customer

    // Pickup address snapshot (shared Address, ownership + tenant validated).
    const addr = await resolvePickupAddress({ addressId: pickup?.addressId, structured: pickup?.structured, legacyString: pickup?.address, customerId: customerRow.id, customerName: customerRow.name, customerPhone: customerRow.phone })
    if (hasItems && !addr.ok) return NextResponse.json({ success: false, error: addr.error }, { status: addr.status || 400 })
    const pickupSnapshot = addr.ok ? (addr.snapshot || null) : null

    // ── Garment LaundryOrder (normal prices) ─────────────────────────────────
    let order: { id: string; orderNumber: string; grandTotal: number } | null = null
    if (hasItems) {
      const store = await prisma.laundryStore.findFirst({ where: { laundryBusinessId: lbId, isActive: true }, select: { id: true, storeCode: true } })
      if (!store) return NextResponse.json({ success: false, error: "No active store configured" }, { status: 400 })
      const isPickup = !!pickupSnapshot
      const { lines } = await resolveOrderBilling(lbId, { storeId: store.id, customerType: isPickup ? "PICKUP" : "WALK_IN", pickup: isPickup, delivery: isPickup }, items)
      const subtotal = lines.reduce((s, l) => s + l.lineAmount, 0)
      const gstTotal = lines.reduce((s, l) => s + l.gstAmount, 0)
      const grandTotal = Math.round((subtotal + gstTotal) * 100) / 100
      const orderNumber = await generateOrderNumber(store.storeCode || lb?.businessCode || `LND-${lbId}`)
      const serviceLines = Array.from(new Map(lines.filter((l) => l.serviceId).map((l) => [l.serviceId, { serviceId: l.serviceId, serviceName: l.serviceName, turnaroundHours: 24 }])).values())
      order = await createLaundryOrder({
        laundryBusinessId: lbId,
        storeId: store.id,
        orderNumber,
        customerId: customerRow.id,
        orderType: isPickup ? "HOME_PICKUP" : "STORE_DROP",
        orderSource: "ONLINE_WEB",
        source: "CUSTOMER_STOREFRONT",
        customerType: isPickup ? "PICKUP" : "WALK_IN",
        lines: lines as never,
        serviceLines,
        financials: { subtotal, gstTotal, grandTotal, balanceDue: grandTotal, paymentStatus: "UNPAID", billed: true },
        paymentPreference: paymentMethod === "ONLINE" ? "FULL_ADVANCE" : "COD",
        pickupDate: pickup?.date ? new Date(pickup.date) : null,
        pickupTimeSlot: pickup?.timeSlot || null,
        pickupAddress: pickupSnapshot,
      })
      // Customer history is updated by the Order Engine (createLaundryOrder).
    }

    // ── Subscription purchase (pending due, not activated) ───────────────────
    let subscription: { purchaseId: string; planName: string; amount: number } | null = null
    if (subscriptionPlanId) {
      const res = await createSubscriptionPurchase({ businessId: platformId, customerId: customerRow.id, planId: subscriptionPlanId, laundryOrderId: order?.id })
      if (!res.ok) {
        if (res.alreadyActive) subscription = null // already subscribed — ignore the plan line
        else return NextResponse.json({ success: false, error: res.error }, { status: 400 })
      } else {
        subscription = { purchaseId: res.purchase.id, planName: res.plan.name, amount: res.purchase.amount }
      }
    }

    const orderTotal = order?.grandTotal ?? 0
    const subscriptionDue = subscription?.amount ?? 0
    const totalDue = Math.round((orderTotal + subscriptionDue) * 100) / 100

    return NextResponse.json({ success: true, data: {
      order: order ? { id: order.id, orderNumber: order.orderNumber, amount: orderTotal, status: "PENDING_STORE_AUDIT", paymentStatus: "UNPAID" } : null,
      subscription: subscription ? { purchaseId: subscription.purchaseId, planName: subscription.planName, amount: subscriptionDue, status: "PAYMENT_PENDING" } : null,
      allocation: { laundryCharges: orderTotal, subscriptionDue, totalDue },
      paymentMethod: paymentMethod || "COD",
      customer: { id: customerRow.id, name: customerRow.name },
      // Online payment gateway handoff is not exercised here (no test env) —
      // COD/Pay-Later places the order + records the pending subscription due.
      paymentPending: true,
    } }, { status: 201 })
  } catch (e) {
    console.error("[laundry-checkout] POST", e)
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : "Checkout failed" }, { status: 500 })
  }
}
