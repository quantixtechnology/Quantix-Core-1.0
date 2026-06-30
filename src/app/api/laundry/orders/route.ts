import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { resolveOrderBilling, orderTypeToCustomerType, type ResolvedItemInput } from "@/lib/laundry-billing-server"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { businessId: businessIdInput, storeId, customerId, orderType, services, items, isExpress, expectedDeliveryDate, paymentPreference, notes, specialInstructions, deliveryOverride, overrideReason, pickupDate, pickupTimeSlot, pickupAddress, pickupInstructions, createdBy } = body

    if (!businessIdInput || !storeId) {
      return NextResponse.json({ error: "Missing required fields: businessId, storeId" }, { status: 400 })
    }

    // Billing line items drive the financial snapshot. `services` is the legacy
    // workflow service list — still accepted, and derived from items if omitted.
    const billingItems: ResolvedItemInput[] = Array.isArray(items) ? items : []
    const hasItems = billingItems.length > 0
    const hasServices = Array.isArray(services) && services.length > 0

    if (!hasItems && !hasServices) {
      return NextResponse.json({ error: "At least one item or service must be provided" }, { status: 400 })
    }

    // Accept either LaundryBusiness.id (owner) or platform Business.id (admin).
    const laundryBusiness = await resolveLaundryBusiness(businessIdInput)
    if (!laundryBusiness) {
      return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })
    }
    const businessId = laundryBusiness.id

    const store = await prisma.laundryStore.findFirst({
      where: { id: storeId, laundryBusinessId: businessId },
    })
    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 })
    }

    if (customerId && laundryBusiness.platformBusinessId) {
      const customer = await prisma.customer.findFirst({
        where: { id: customerId, businessId: laundryBusiness.platformBusinessId },
      })
      if (!customer) {
        return NextResponse.json({ error: "Customer not found" }, { status: 404 })
      }
    }

    const now = new Date()
    const monthPrefix = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`
    const prefix = `ORD-${monthPrefix}-`

    const lastOrder = await prisma.laundryOrder.findFirst({
      where: { orderNumber: { startsWith: prefix } },
      orderBy: { orderNumber: "desc" },
      select: { orderNumber: true },
    })

    let nextSeq = 1
    if (lastOrder) {
      const parts = lastOrder.orderNumber.split("-")
      nextSeq = parseInt(parts[parts.length - 1], 10) + 1
    }
    const orderNumber = `${prefix}${String(nextSeq).padStart(6, "0")}`

    // ── Resolve the financial snapshot from the Pricing Engine (server-side,
    //    authoritative) and persist it on the order. Never recalculated later. ──
    const resolvedOrderType = orderType || "WALK_IN"
    const customerType = orderTypeToCustomerType(resolvedOrderType)
    const isPickup = resolvedOrderType === "HOME_PICKUP"
    let billing: Awaited<ReturnType<typeof resolveOrderBilling>> | null = null
    if (hasItems) {
      billing = await resolveOrderBilling(
        businessId,
        { storeId, customerType, express: !!isExpress, pickup: isPickup, delivery: isPickup },
        billingItems,
      )
    }
    const q = billing?.quote
    const grandTotal = q?.grandTotal ?? 0

    // Workflow service lines: use provided services, else distinct from items.
    const serviceLines: { serviceId: string | null; serviceName: string; turnaroundHours: number }[] = hasServices
      ? services.map((s: { serviceId?: string; serviceName: string; turnaroundHours?: number }) => ({
          serviceId: s.serviceId || null, serviceName: s.serviceName, turnaroundHours: s.turnaroundHours || 24,
        }))
      : Array.from(
          new Map(
            (billing?.lines || [])
              .filter((l) => l.serviceId)
              .map((l) => [l.serviceId, { serviceId: l.serviceId, serviceName: l.serviceName, turnaroundHours: 24 }]),
          ).values(),
        )

    const order = await prisma.laundryOrder.create({
      data: {
        orderNumber,
        businessId,
        storeId,
        customerId: customerId || null,
        orderType: resolvedOrderType,
        source: "MANUAL",
        status: "PENDING_STORE_AUDIT",
        paymentPreference: paymentPreference || "COD",
        expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : null,
        deliveryOverride: deliveryOverride || false,
        overrideReason: overrideReason || null,
        pickupDate: pickupDate ? new Date(pickupDate) : null,
        pickupTimeSlot: pickupTimeSlot || null,
        pickupAddress: pickupAddress || null,
        pickupInstructions: pickupInstructions || null,
        specialInstructions: specialInstructions || null,
        notes: notes || null,
        createdBy: createdBy || null,
        // Financial snapshot
        subtotal: q?.subtotal ?? 0,
        gstTotal: q?.gstTotal ?? 0,
        pickupCharge: q?.pickupCharge ?? 0,
        deliveryCharge: q?.deliveryCharge ?? 0,
        expressCharge: q?.expressCharge ?? 0,
        discount: 0,
        grandTotal,
        amountPaid: 0,
        balanceDue: grandTotal,
        paymentStatus: customerType === "SUBSCRIPTION" && grandTotal === 0 ? "SUBSCRIPTION" : "UNPAID",
        isExpress: !!isExpress,
        customerType,
        billedAt: hasItems ? new Date() : null,
        services: { create: serviceLines },
        items: billing
          ? { create: billing.lines.map((l) => ({
              serviceId: l.serviceId, serviceName: l.serviceName,
              garmentId: l.garmentId, garmentName: l.garmentName, categoryId: l.categoryId,
              pricingRuleId: l.pricingRuleId, pricingType: l.pricingType,
              quantity: l.quantity, weightKg: l.weightKg, unitPrice: l.unitPrice,
              lineAmount: l.lineAmount, gstPercent: l.gstPercent, gstAmount: l.gstAmount,
              discount: l.discount, total: l.total,
            })) }
          : undefined,
      },
      include: {
        services: true,
        items: true,
        store: { select: { storeName: true, storeCode: true } },
      },
    })

    await prisma.laundryAuditLog.create({
      data: {
        businessId,
        actorId: createdBy || "system",
        actorName: createdBy || "System",
        section: "ORDER_CREATION",
        field: "orderNumber",
        oldValue: null,
        newValue: orderNumber,
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
      },
    })

    return NextResponse.json({ success: true, data: order }, { status: 201 })
  } catch (error) {
    console.error("[laundry-orders] POST Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get("businessId")
    const status = searchParams.get("status")
    const storeId = searchParams.get("storeId")
    const customerId = searchParams.get("customerId")
    const from = searchParams.get("from")
    const to = searchParams.get("to")
    const search = searchParams.get("search")
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100)
    const offset = parseInt(searchParams.get("offset") || "0")

    if (!businessId) {
      return NextResponse.json({ error: "Missing businessId parameter" }, { status: 400 })
    }

    const resolved = await resolveLaundryBusiness(businessId)
    if (!resolved) {
      return NextResponse.json({ success: true, data: [], total: 0, limit, offset })
    }

    const where: Record<string, unknown> = { businessId: resolved.id }
    if (status) where.status = status
    if (storeId) where.storeId = storeId
    if (customerId) where.customerId = customerId
    if (from || to) {
      const createdAt: Record<string, Date> = {}
      if (from) createdAt.gte = new Date(from)
      if (to) createdAt.lte = new Date(to)
      where.createdAt = createdAt
    }
    if (search) {
      where.OR = [
        { orderNumber: { contains: search } },
        { notes: { contains: search } },
      ]
    }

    const [orders, total] = await Promise.all([
      prisma.laundryOrder.findMany({
        where: where as any,
        include: {
          services: true,
          store: { select: { storeName: true, storeCode: true } },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.laundryOrder.count({ where: where as any }),
    ])

    return NextResponse.json({ success: true, data: orders, total, limit, offset })
  } catch (error) {
    console.error("[laundry-orders] GET Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
