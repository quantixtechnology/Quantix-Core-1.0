// POST /api/core/storefront/laundry-order
//
// Creates a REAL Laundry order from the customer website. It reuses the exact
// Laundry order domain — same LaundryOrder/LaundryOrderItem model, the same
// server-side Billing Resolver (resolveOrderBilling) for the price snapshot, and
// the same enterprise ID generator (generateOrderNumber → ORD-…, ITM-… items).
// No parallel order system is introduced. The order is created in the first
// operational stage (PENDING_STORE_AUDIT) so it flows through Laundry OS.
//
// Subscription orders (CLOTH_ALLOWANCE): covered garments are snapshot at ₹0
// (pricingType SUBSCRIPTION) and only the EXTRA garments are priced by the
// resolver. Coverage is deterministic (customer line order) and recorded on an
// auditable SubscriptionUsage row + the plan counters.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { resolveOrderBilling } from "@/lib/laundry-billing-server"
import { generateOrderNumber, generateCustomerCode } from "@/lib/laundry-codes"
import { computeSubscriptionAllocation, type SubscriptionState } from "@/lib/laundry-subscription"

export const runtime = "nodejs"

interface OrderItemInput { serviceId: string; garmentId: string; quantity: number }

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { businessId, items, customer, pickup, useSubscription, forceNormal } = body as {
      businessId?: string
      items?: OrderItemInput[]
      customer?: { name?: string; phone?: string; email?: string; id?: string }
      pickup?: { address?: string; date?: string; timeSlot?: string; instructions?: string }
      useSubscription?: boolean
      forceNormal?: boolean
    }
    if (!businessId) return NextResponse.json({ success: false, error: "businessId is required" }, { status: 400 })
    if (!Array.isArray(items) || items.length === 0) return NextResponse.json({ success: false, error: "items are required" }, { status: 400 })
    if (!customer?.name || !customer?.phone) return NextResponse.json({ success: false, error: "customer name and phone are required" }, { status: 400 })

    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ success: false, error: "Laundry business not found" }, { status: 404 })
    const lbId = biz.id
    const platformId = biz.platformBusinessId || businessId
    const lb = await prisma.laundryBusiness.findUnique({ where: { id: lbId }, select: { businessCode: true } })

    // Store — first active laundry store for this workspace.
    const store = await prisma.laundryStore.findFirst({ where: { laundryBusinessId: lbId, isActive: true }, select: { id: true, storeCode: true } })
    if (!store) return NextResponse.json({ success: false, error: "No active store configured" }, { status: 400 })

    // Customer — reuse an existing one by phone, else create a guest.
    let customerRow = customer.id
      ? await prisma.customer.findFirst({ where: { id: customer.id, businessId: platformId } })
      : await prisma.customer.findFirst({ where: { businessId: platformId, phone: customer.phone } })
    if (!customerRow) {
      const code = await generateCustomerCode(lb?.businessCode || `LND-${lbId}`)
      customerRow = await prisma.customer.create({
        data: { businessId: platformId, name: customer.name, phone: customer.phone, email: customer.email || null, customerCode: code, source: "STOREFRONT", isGuest: true },
      })
    }

    // ── Subscription context (optional) ──────────────────────────────────────
    let sub: { id: string; totalCredits: number; planName: string; maxOrders: number | null } | null = null
    let allocation: ReturnType<typeof computeSubscriptionAllocation> | null = null
    if (useSubscription) {
      const active = await prisma.customerSubscription.findFirst({
        where: { businessId: platformId, customerId: customerRow.id, status: "ACTIVE" },
        include: { plan: { select: { name: true, totalCredits: true, maxOrdersPerCycle: true, serviceType: true } }, usages: { select: { creditsUsed: true } } },
      })
      // Entitlement guard: the checkbox must never silently create a subscription
      // order when there is no active plan.
      if (!active && !forceNormal) {
        return NextResponse.json({ success: false, noSubscription: true, reason: "You don't have an active laundry subscription." }, { status: 200 })
      }
      if (active) {
        const usedCredits = active.usages.reduce((s, u) => s + (u.creditsUsed || 0), 0)
        const state: SubscriptionState = { totalCredits: active.totalCredits || active.plan.totalCredits, usedCredits, ordersUsed: active.usages.length, maxOrdersPerCycle: active.plan.maxOrdersPerCycle ?? null }
        allocation = computeSubscriptionAllocation(state, items)
        if (allocation.blocked && !forceNormal) {
          return NextResponse.json({ success: false, needsNormalOrder: true, reason: allocation.reason, subscription: { remaining: state.totalCredits - usedCredits, ordersUsed: state.ordersUsed, maxOrders: state.maxOrdersPerCycle } })
        }
        if (!allocation.blocked) sub = { id: active.id, totalCredits: state.totalCredits, planName: active.plan.name, maxOrders: state.maxOrdersPerCycle }
      }
    }

    // ── Price snapshot via the Billing Resolver (authoritative, server-side) ──
    const isPickup = !!pickup?.address
    const customerType = sub ? "SUBSCRIPTION" : (isPickup ? "PICKUP" : "WALK_IN")
    const { lines: resolved } = await resolveOrderBilling(lbId, { storeId: store.id, customerType: sub ? null : customerType, pickup: isPickup, delivery: isPickup }, items)

    // Build order items. For a subscription order, split each line into a
    // covered part (₹0, SUBSCRIPTION) and a chargeable extra part (resolved).
    const orderNumber = await generateOrderNumber(store.storeCode || lb?.businessCode || `LND-${lbId}`)
    interface Line { serviceId: string | null; serviceName: string; garmentId: string | null; garmentName: string; categoryId: string | null; pricingRuleId: string | null; pricingType: string; quantity: number; unitPrice: number; lineAmount: number; gstPercent: number; gstAmount: number; total: number }
    const orderLines: Line[] = []

    if (sub && allocation) {
      // Deterministic coverage in customer line order (matches the engine).
      let remaining = allocation.availableBefore
      for (let i = 0; i < items.length; i++) {
        const r = resolved[i]
        const qty = Math.max(0, Math.floor(items[i].quantity))
        const covered = Math.min(qty, remaining)
        remaining -= covered
        const extra = qty - covered
        if (covered > 0) orderLines.push({ serviceId: r.serviceId, serviceName: r.serviceName, garmentId: r.garmentId, garmentName: r.garmentName, categoryId: r.categoryId, pricingRuleId: null, pricingType: "SUBSCRIPTION", quantity: covered, unitPrice: 0, lineAmount: 0, gstPercent: 0, gstAmount: 0, total: 0 })
        if (extra > 0) { const gstAmt = Math.round(r.unitPrice * extra * (r.gstPercent || 0)) / 100; orderLines.push({ serviceId: r.serviceId, serviceName: r.serviceName, garmentId: r.garmentId, garmentName: r.garmentName, categoryId: r.categoryId, pricingRuleId: r.pricingRuleId, pricingType: r.pricingType, quantity: extra, unitPrice: r.unitPrice, lineAmount: r.unitPrice * extra, gstPercent: r.gstPercent, gstAmount: gstAmt, total: r.unitPrice * extra + gstAmt }) }
      }
    } else {
      for (const r of resolved) orderLines.push({ serviceId: r.serviceId, serviceName: r.serviceName, garmentId: r.garmentId, garmentName: r.garmentName, categoryId: r.categoryId, pricingRuleId: r.pricingRuleId, pricingType: r.pricingType, quantity: r.quantity, unitPrice: r.unitPrice, lineAmount: r.lineAmount, gstPercent: r.gstPercent, gstAmount: r.gstAmount, total: r.total })
    }

    const subtotal = orderLines.reduce((s, l) => s + l.lineAmount, 0)
    const gstTotal = orderLines.reduce((s, l) => s + l.gstAmount, 0)
    const grandTotal = Math.round((subtotal + gstTotal) * 100) / 100

    // Distinct workflow service lines
    const serviceLines = Array.from(new Map(orderLines.filter((l) => l.serviceId).map((l) => [l.serviceId, { serviceId: l.serviceId, serviceName: l.serviceName, turnaroundHours: 24 }])).values())

    const order = await prisma.laundryOrder.create({
      data: {
        orderNumber, businessId: lbId, storeId: store.id, customerId: customerRow.id,
        orderType: sub ? "SUBSCRIPTION" : (isPickup ? "HOME_PICKUP" : "STORE_DROP"),
        source: "CUSTOMER_STOREFRONT",
        status: "PENDING_STORE_AUDIT",
        paymentPreference: sub ? "SUBSCRIPTION_BILLING" : "COD",
        pickupDate: pickup?.date ? new Date(pickup.date) : null,
        pickupTimeSlot: pickup?.timeSlot || null,
        pickupAddress: pickup?.address || null,
        pickupInstructions: pickup?.instructions || null,
        subtotal, gstTotal, pickupCharge: 0, deliveryCharge: 0, expressCharge: 0, discount: 0,
        grandTotal, amountPaid: 0, balanceDue: grandTotal,
        paymentStatus: sub && grandTotal === 0 ? "SUBSCRIPTION" : "UNPAID",
        customerType, billedAt: new Date(),
        services: { create: serviceLines },
        items: { create: orderLines.map((l, i) => ({ itemNumber: `ITM-${orderNumber}-${String(i + 1).padStart(4, "0")}`, barcode: `ITM-${orderNumber}-${String(i + 1).padStart(4, "0")}`, serviceId: l.serviceId, serviceName: l.serviceName, garmentId: l.garmentId, garmentName: l.garmentName, categoryId: l.categoryId, pricingRuleId: l.pricingRuleId, pricingType: l.pricingType, quantity: l.quantity, weightKg: 0, unitPrice: l.unitPrice, lineAmount: l.lineAmount, gstPercent: l.gstPercent, gstAmount: l.gstAmount, discount: 0, total: l.total })) },
      },
      include: { items: true, store: { select: { storeName: true, storeCode: true } } },
    })

    // ── Persist auditable subscription usage + update counters ────────────────
    let subscriptionResult: Record<string, number> | null = null
    if (sub && allocation) {
      await prisma.subscriptionUsage.create({
        data: { subscriptionId: sub.id, orderId: order.id, creditsUsed: allocation.covered,
          description: JSON.stringify({ orderNumber, submitted: allocation.submitted, covered: allocation.covered, extra: allocation.extra, extraCharge: grandTotal }) },
      })
      await prisma.customerSubscription.update({
        where: { id: sub.id },
        data: { usedCredits: allocation.usedAfter, remainingCredits: allocation.remainingAfter },
      })
      subscriptionResult = { covered: allocation.covered, extra: allocation.extra, remaining: allocation.remainingAfter, planAllowance: sub.totalCredits, ordersUsed: allocation.ordersUsedAfter, maxOrders: sub.maxOrders ?? 0, extraCharge: grandTotal }
    }

    await prisma.customer.update({ where: { id: customerRow.id }, data: { totalOrders: { increment: 1 }, totalSpent: { increment: grandTotal }, lastOrderAt: new Date() } }).catch(() => {})

    return NextResponse.json({ success: true, data: {
      orderId: order.id, orderNumber: order.orderNumber, status: order.status,
      subtotal, gstTotal, grandTotal,
      pickup: { date: order.pickupDate, timeSlot: order.pickupTimeSlot, address: order.pickupAddress },
      customer: { id: customerRow.id, name: customerRow.name },
      subscription: subscriptionResult,
    } }, { status: 201 })
  } catch (e) {
    console.error("[laundry-order] POST", e)
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : "Order failed" }, { status: 500 })
  }
}
