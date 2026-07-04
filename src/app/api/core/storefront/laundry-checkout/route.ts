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
import { generateOrderNumber, generateCustomerCode } from "@/lib/laundry-codes"
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

    // Customer (reuse by phone, else guest).
    let customerRow = await prisma.customer.findFirst({ where: { businessId: platformId, phone: customer.phone } })
    if (!customerRow) {
      if (!customer.email?.trim()) return NextResponse.json({ success: false, error: "Email is required to create your account" }, { status: 400 })
      const code = await generateCustomerCode(lb?.businessCode || `LND-${lbId}`)
      customerRow = await prisma.customer.create({ data: { businessId: platformId, name: customer.name, phone: customer.phone, email: customer.email.trim().toLowerCase(), customerCode: code, source: "STOREFRONT", isGuest: true } })
    }

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
      const created = await prisma.laundryOrder.create({
        data: {
          orderNumber, businessId: lbId, storeId: store.id, customerId: customerRow.id,
          orderType: isPickup ? "HOME_PICKUP" : "STORE_DROP", source: "CUSTOMER_STOREFRONT", status: "PENDING_STORE_AUDIT",
          paymentPreference: paymentMethod === "ONLINE" ? "FULL_ADVANCE" : "COD",
          pickupDate: pickup?.date ? new Date(pickup.date) : null, pickupTimeSlot: pickup?.timeSlot || null, pickupAddress: pickupSnapshot,
          subtotal, gstTotal, pickupCharge: 0, deliveryCharge: 0, expressCharge: 0, discount: 0,
          grandTotal, amountPaid: 0, balanceDue: grandTotal, paymentStatus: "UNPAID", customerType: isPickup ? "PICKUP" : "WALK_IN", billedAt: new Date(),
          services: { create: serviceLines },
          items: { create: lines.map((l, i) => ({ itemNumber: `ITM-${orderNumber}-${String(i + 1).padStart(4, "0")}`, barcode: `ITM-${orderNumber}-${String(i + 1).padStart(4, "0")}`, serviceId: l.serviceId, serviceName: l.serviceName, garmentId: l.garmentId, garmentName: l.garmentName, categoryId: l.categoryId, pricingRuleId: l.pricingRuleId, pricingType: l.pricingType, quantity: l.quantity, weightKg: 0, unitPrice: l.unitPrice, lineAmount: l.lineAmount, gstPercent: l.gstPercent, gstAmount: l.gstAmount, discount: 0, total: l.total })) },
        },
        select: { id: true, orderNumber: true, grandTotal: true },
      })
      order = created
      await prisma.customer.update({ where: { id: customerRow.id }, data: { totalOrders: { increment: 1 }, lastOrderAt: new Date() } }).catch(() => {})
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
