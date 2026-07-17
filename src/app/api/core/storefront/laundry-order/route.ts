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
import { resolvePickupAddress, type StructuredAddress } from "@/lib/laundry-address"
import { generateOrderNumber } from "@/lib/laundry-codes"
import { resolveOrCreateLaundryCustomer } from "@/lib/customer-identity"
import { computeSubscriptionAllocation, type SubscriptionState } from "@/lib/laundry-subscription"
import { createLaundryOrder } from "@/lib/laundry-order-engine"

export const runtime = "nodejs"

interface OrderItemInput { serviceId: string; garmentId: string; quantity: number }

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { businessId, items, services, customer, pickup, useSubscription, forceNormal } = body as {
      businessId?: string
      items?: OrderItemInput[]
      services?: { serviceId: string; serviceName?: string }[] // Pickup-First (Bag) services — no items
      customer?: { name?: string; phone?: string; email?: string; id?: string }
      pickup?: { address?: string; addressId?: string; structured?: StructuredAddress; date?: string; timeSlot?: string; instructions?: string }
      useSubscription?: boolean
      forceNormal?: boolean
    }
    if (!businessId) return NextResponse.json({ success: false, error: "businessId is required" }, { status: 400 })
    // Pickup-First (Bag) services carry no garments/price — one workflow service
    // line per bag; garments are counted later at Store Audit.
    const bagServiceLines = Array.isArray(services) ? services.filter((s) => s?.serviceId).map((s) => ({ serviceId: s.serviceId, serviceName: s.serviceName || "Service", turnaroundHours: 24 })) : []
    const hasItems = Array.isArray(items) && items.length > 0
    if (!hasItems && bagServiceLines.length === 0) return NextResponse.json({ success: false, error: "items or services are required" }, { status: 400 })
    if (!customer?.name || !customer?.phone) return NextResponse.json({ success: false, error: "customer name and phone are required" }, { status: 400 })

    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ success: false, error: "Laundry business not found" }, { status: 404 })
    const lbId = biz.id
    const platformId = biz.platformBusinessId || businessId
    const lb = await prisma.laundryBusiness.findUnique({ where: { id: lbId }, select: { businessCode: true } })

    // Store — first active laundry store for this workspace.
    const store = await prisma.laundryStore.findFirst({ where: { laundryBusinessId: lbId, isActive: true }, select: { id: true, storeCode: true } })
    if (!store) return NextResponse.json({ success: false, error: "No active store configured" }, { status: 400 })

    // Canonical customer — ONE shared resolver (normalized email/phone + id +
    // auth linkage) so no duplicate is created due to phone format / missing
    // email / channel. A genuinely new customer must provide an email.
    const custResolved = await resolveOrCreateLaundryCustomer({
      platformBusinessId: platformId, businessCodeForCode: lb?.businessCode || `LND-${lbId}`,
      name: customer.name, phone: customer.phone, email: customer.email, customerId: customer.id,
      source: "STOREFRONT", emailRequiredForNew: true,
    })
    if (!custResolved.customer) return NextResponse.json({ success: false, error: custResolved.error || "Could not resolve customer" }, { status: 400 })
    const customerRow = custResolved.customer

    // Pickup address — shared Address (ownership + tenant validated) snapshotted
    // onto the order for historical integrity.
    const addr = await resolvePickupAddress({
      addressId: pickup?.addressId, structured: pickup?.structured, legacyString: pickup?.address,
      customerId: customerRow.id, customerName: customerRow.name, customerPhone: customerRow.phone,
    })
    if (!addr.ok) return NextResponse.json({ success: false, error: addr.error }, { status: addr.status || 400 })
    const pickupSnapshot = addr.snapshot || null

    // ── Subscription context (optional) ──────────────────────────────────────
    let sub: { id: string; totalCredits: number; planName: string; maxOrders: number | null } | null = null
    let allocation: ReturnType<typeof computeSubscriptionAllocation> | null = null
    if (useSubscription && hasItems) {
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
    // Bag (Pickup-First) orders carry no items → no billing here; garments are
    // priced later at Store Audit (billed = false).
    const isPickup = !!pickupSnapshot
    const customerType = sub ? "SUBSCRIPTION" : (isPickup ? "PICKUP" : "WALK_IN")
    const resolved = hasItems
      ? (await resolveOrderBilling(lbId, { storeId: store.id, customerType: sub ? null : customerType, pickup: isPickup, delivery: isPickup }, items!)).lines
      : []

    // Build order items. For a subscription order, split each line into a
    // covered part (₹0, SUBSCRIPTION) and a chargeable extra part (resolved).
    const orderNumber = await generateOrderNumber(store.storeCode || lb?.businessCode || `LND-${lbId}`)
    interface Line { serviceId: string | null; serviceName: string; garmentId: string | null; garmentName: string; categoryId: string | null; pricingRuleId: string | null; pricingType: string; quantity: number; unitPrice: number; lineAmount: number; gstPercent: number; gstAmount: number; total: number }
    const orderLines: Line[] = []

    if (sub && allocation) {
      // Deterministic coverage in customer line order (matches the engine).
      let remaining = allocation.availableBefore
      for (let i = 0; i < items!.length; i++) {
        const r = resolved[i]
        const qty = Math.max(0, Math.floor(items![i].quantity))
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

    // Distinct workflow service lines = garment-derived + Pickup-First bag services.
    const derivedServiceLines = orderLines.filter((l) => l.serviceId).map((l) => ({ serviceId: l.serviceId as string, serviceName: l.serviceName, turnaroundHours: 24 }))
    const serviceLines = Array.from(new Map([...derivedServiceLines, ...bagServiceLines].map((s) => [s.serviceId, s])).values())

    const order = await createLaundryOrder({
      laundryBusinessId: lbId,
      storeId: store.id,
      orderNumber,
      customerId: customerRow.id,
      orderType: sub ? "SUBSCRIPTION" : (isPickup ? "HOME_PICKUP" : "STORE_DROP"),
      orderSource: "ONLINE_WEB",
      source: "CUSTOMER_STOREFRONT",
      customerType,
      lines: orderLines as never,
      serviceLines,
      financials: {
        subtotal, gstTotal, grandTotal, balanceDue: grandTotal,
        paymentStatus: sub && grandTotal === 0 ? "SUBSCRIPTION" : "UNPAID",
        billed: hasItems, // Bag orders are billed later, at Store Audit
      },
      paymentPreference: sub ? "SUBSCRIPTION_BILLING" : "COD",
      pickupDate: pickup?.date ? new Date(pickup.date) : null,
      pickupTimeSlot: pickup?.timeSlot || null,
      pickupAddress: pickupSnapshot,
      pickupInstructions: pickup?.instructions || null,
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

    // (Customer history — totalOrders/totalSpent/lastOrderAt — is updated by the
    // Order Engine during createLaundryOrder above.)

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
