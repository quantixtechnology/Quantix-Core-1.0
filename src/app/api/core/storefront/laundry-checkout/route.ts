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
// AUTH: If a Bearer token is present, the authenticated User is resolved and
// the Customer is looked up by userId. Server-side name/phone from the User
// record are authoritative — client-provided name/phone are NEVER trusted for
// authenticated users. If the resolved Customer has no name or phone, the API
// returns PROFILE_INCOMPLETE.
//
// Body: { businessId, items?: [{serviceId,garmentId,quantity}], subscriptionPlanId?,
//         customer:{name?,phone?,email?}, pickup?, paymentMethod?: "COD"|"ONLINE" }
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { resolveOrderBilling } from "@/lib/laundry-billing-server"
import { generateOrderNumber } from "@/lib/laundry-codes"
import { createLaundryOrder } from "@/lib/laundry-order-engine"
import { resolveOrCreateLaundryCustomer } from "@/lib/customer-identity"
import { resolvePickupAddress, type StructuredAddress } from "@/lib/laundry-address"
import { resolveLaundryStoreForPickup } from "@/lib/laundry-serviceability"
import { createSubscriptionPurchase } from "@/lib/laundry-subscription-purchase"
import { assertDeliverySlotAvailable } from "@/lib/laundry-slot-capacity"
import { assertLaundryBookingOpen } from "@/lib/laundry-availability"
import { slotHasEnded } from "@/lib/laundry-slots"
import { hasMixedDeliveryTypes, MIXED_DELIVERY_MESSAGE } from "@/lib/laundry-tat"

export const runtime = "nodejs"

interface Item { serviceId: string; garmentId: string; quantity: number }

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { businessId, items, subscriptionPlanId, customer, pickup, delivery, backupDelivery, paymentMethod } = body as {
      businessId?: string; items?: Item[]; subscriptionPlanId?: string
      customer?: { name?: string; phone?: string; email?: string; id?: string }
      pickup?: { address?: string; addressId?: string; structured?: StructuredAddress; date?: string; timeSlot?: string }
      delivery?: { date?: string; timeSlot?: string }
      backupDelivery?: { date?: string; timeSlot?: string }
      paymentMethod?: "COD" | "ONLINE"
    }
    if (!businessId) return NextResponse.json({ success: false, error: "businessId is required" }, { status: 400 })
    const hasItems = Array.isArray(items) && items.length > 0
    if (!hasItems && !subscriptionPlanId) return NextResponse.json({ success: false, error: "Cart is empty" }, { status: 400 })

    // ── Resolve authenticated user from Bearer token ──────────────────────────
    const authHeader = request.headers.get("authorization") || ""
    const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null
    let resolvedUser: { id: string; name: string; email: string; phone: string | null } | null = null
    if (bearerToken) {
      const rt = await prisma.refreshToken.findFirst({ where: { token: bearerToken, expiresAt: { gte: new Date() } }, select: { userId: true } })
      if (rt?.userId) {
        resolvedUser = await prisma.user.findUnique({ where: { id: rt.userId }, select: { id: true, name: true, email: true, phone: true } })
      }
    }

    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ success: false, error: "Laundry business not found" }, { status: 404 })
    const lbId = biz.id
    const platformId = biz.platformBusinessId || businessId

    // ── Availability guard — store must be open now AND every requested
    //    date/slot must fall inside that day's working hours. This reuses the
    //    Commerce checkStoreOpen machinery (single source of truth) and only
    //    gates customer-facing channels; admins are never affected.
    const guard = await assertLaundryBookingOpen(businessId, {
      pickupDate: pickup?.date || null,
      pickupSlot: pickup?.timeSlot || null,
      deliveryDate: delivery?.date || null,
      deliverySlot: delivery?.timeSlot || null,
      backupDate: backupDelivery?.date || null,
      backupSlot: backupDelivery?.timeSlot || null,
    })
    if (!guard.ok) return NextResponse.json({ success: false, error: guard.error }, { status: 409 })

    // Canonical customer — resolved from auth userid (server-side) when
    // authenticated, or from client-provided values as a guest fallback.
    const resolved = await resolveOrCreateLaundryCustomer({
      platformBusinessId: platformId, businessCodeForCode: biz.businessCode,
      userId: resolvedUser?.id || undefined,
      name: resolvedUser?.name || customer?.name || undefined,
      phone: resolvedUser?.phone || customer?.phone || undefined,
      email: resolvedUser?.email || customer?.email || undefined,
      customerId: customer?.id,
      source: "STOREFRONT",
      emailRequiredForNew: !resolvedUser,
    })
    if (!resolved.customer) return NextResponse.json({ success: false, error: resolved.error || "Could not resolve customer" }, { status: 400 })
    const customerRow = resolved.customer

    // ── Validate profile completeness ─────────────────────────────────────────
    if (!customerRow.name || !customerRow.phone) {
      return NextResponse.json({ success: false, error: "PROFILE_INCOMPLETE" }, { status: 400 })
    }

    // Pickup address snapshot (shared Address, ownership + tenant validated).
    const addr = await resolvePickupAddress({ addressId: pickup?.addressId, structured: pickup?.structured, legacyString: pickup?.address, customerId: customerRow.id, customerName: customerRow.name, customerPhone: customerRow.phone })
    if (hasItems && !addr.ok) return NextResponse.json({ success: false, error: addr.error }, { status: addr.status || 400 })
    const pickupSnapshot = addr.ok ? (addr.snapshot || null) : null

    // FINAL SAFETY CHECK. One order carries one delivery promise, so a mixed
    // Standard + Express body is refused here too — the client blocks it, but a
    // stale tab or a crafted request must not create an order whose promise
    // cannot be honoured. Several standard services together, or several
    // express services together, are unaffected.
    const svcIds = [...new Set((items || []).map((i: { serviceId?: string }) => i.serviceId).filter(Boolean))] as string[]
    if (svcIds.length > 1) {
      const svcs = await prisma.laundryService.findMany({ where: { id: { in: svcIds } }, select: { tatEnabled: true } })
      if (hasMixedDeliveryTypes(svcs)) {
        return NextResponse.json({ success: false, error: MIXED_DELIVERY_MESSAGE }, { status: 400 })
      }
    }

    // SERVER-SIDE PICKUP WINDOW CHECK. The client greys out and re-selects an
    // ended slot, but a stale tab, a replayed request or a crafted body must not
    // be able to book a pickup for a window that has already closed. Judged on
    // the slot's END in business local time, so a slot currently underway is
    // still bookable — this is not a "date < today" rule.
    if (pickup?.date && pickup?.timeSlot && slotHasEnded(pickup.timeSlot, pickup.date)) {
      return NextResponse.json({ success: false, error: "That pickup slot has already ended. Please choose another slot." }, { status: 400 })
    }


    // ── Garment LaundryOrder (normal prices) ─────────────────────────────────
    let order: { id: string; orderNumber: string; grandTotal: number } | null = null
    if (hasItems) {
      const storeResolution = await resolveLaundryStoreForPickup({
        laundryBusinessId: lbId,
        businessId: platformId,
        lat: addr.latitude,
        lng: addr.longitude,
        pickupAddressId: addr.addressId ?? null,
      })
      if (!storeResolution.ok) {
        return NextResponse.json({
          success: false,
          error: storeResolution.reason || storeResolution.error || "We don't deliver to this address yet.",
          code: "OUT_OF_SERVICE_AREA",
          nearestStore: storeResolution.nearestStore,
          serviceability: {
            status: storeResolution.serviceabilityStatus,
            pickupDistanceKm: storeResolution.pickupDistanceKm,
            deliveryZoneId: storeResolution.deliveryZoneId,
          },
        }, { status: storeResolution.status || 422 })
      }
      const store = await prisma.laundryStore.findUnique({ where: { id: storeResolution.storeId! }, select: { id: true, storeCode: true } })
      if (!store) return NextResponse.json({ success: false, error: "No active store configured" }, { status: 400 })
      const isPickup = !!pickupSnapshot
      const { lines } = await resolveOrderBilling(lbId, { storeId: store.id, customerType: isPickup ? "PICKUP" : "WALK_IN", pickup: isPickup, delivery: isPickup }, items)
      const subtotal = lines.reduce((s, l) => s + l.lineAmount, 0)
      const gstTotal = lines.reduce((s, l) => s + l.gstAmount, 0)
      const grandTotal = Math.round((subtotal + gstTotal) * 100) / 100
      const orderNumber = await generateOrderNumber(store.storeCode || biz.businessCode)
      // ── Delivery slot capacity — reject bookings on full (date + time slot)
      //    for BOTH the Standard and the Backup (Alternate) delivery schedule.
      const slotChecks: ReturnType<typeof assertDeliverySlotAvailable>[] = []
      if (delivery?.date && delivery?.timeSlot) slotChecks.push(assertDeliverySlotAvailable(lbId, delivery.date, delivery.timeSlot))
      if (backupDelivery?.date && backupDelivery?.timeSlot) slotChecks.push(assertDeliverySlotAvailable(lbId, backupDelivery.date, backupDelivery.timeSlot))
      const slotResults = await Promise.all(slotChecks)
      for (const r of slotResults) if (!r.ok) return NextResponse.json({ success: false, error: r.error }, { status: 409 })
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
        deliveryDate: delivery?.date ? new Date(delivery.date) : null,
        deliveryTimeSlot: delivery?.timeSlot || null,
        backupDeliveryDate: backupDelivery?.date ? new Date(backupDelivery.date) : null,
        backupDeliveryTimeSlot: backupDelivery?.timeSlot || null,
        pickupAddress: pickupSnapshot,
        pickupAddressId: storeResolution.pickupAddressId ?? null,
        pickupDistanceKm: storeResolution.pickupDistanceKm ?? null,
        serviceabilityStatus: storeResolution.serviceabilityStatus ?? null,
        deliveryZoneId: storeResolution.deliveryZoneId ?? null,
      })
    }

    // ── Subscription purchase (pending due, not activated) ───────────────────
    let subscription: { purchaseId: string; planName: string; amount: number } | null = null
    if (subscriptionPlanId) {
      const res = await createSubscriptionPurchase({ businessId: platformId, customerId: customerRow.id, planId: subscriptionPlanId, laundryOrderId: order?.id })
      if (!res.ok) {
        // Already an active/grace membership for this plan. For a subscription-only
        // request that is the whole intent → REJECT (don't pretend it succeeded).
        // For a mixed cart (has garments) → keep the order, just skip the add-on.
        if (res.alreadyActive && !hasItems) return NextResponse.json({ success: false, error: res.error, alreadyActive: true }, { status: 409 })
        if (res.alreadyActive) subscription = null
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
      paymentPending: true,
    } }, { status: 201 })
  } catch (e) {
    console.error("[laundry-checkout] POST", e)
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : "Checkout failed" }, { status: 500 })
  }
}
