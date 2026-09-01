import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { resolveOrderBilling, orderTypeToCustomerType, type ResolvedItemInput } from "@/lib/laundry-billing-server"
import { unavailableCombinationError } from "@/lib/laundry-garment-services"
import { generateOrderNumber } from "@/lib/laundry-codes"
import { createLaundryOrder, defaultOrderSource } from "@/lib/laundry-order-engine"
import { oneServiceError } from "@/lib/laundry-one-service"
import { applySubscriptionToOrder } from "@/lib/laundry-subscription-server"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { getTransportModes, orderIdsByTransportSearch, transportRefsForOrders } from "@/lib/laundry-transport-server"
import { usesPacket } from "@/lib/laundry-transport"
import { buildReportRow, type ReportOrder } from "@/lib/laundry-order-report"
import { operationalStage, STATUS_QUEUES, PROCESSING_QUEUES, UNASSIGNED, stagesForKey, stagesBefore } from "@/lib/laundry-operational-stage"

export const runtime = "nodejs"

// A report is a file, not a page, so it is not paginated — but it is still
// bounded, so one export cannot pull an unbounded result set into memory. The
// response says when it was reached rather than silently shortening the file.
const REPORT_MAX_ROWS = 5000

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { businessId: businessIdInput, storeId, customerId, orderType, orderSource, services, items, isExpress, expectedDeliveryDate, paymentPreference, notes, specialInstructions, deliveryOverride, overrideReason, pickupRequired, deliveryRequired, pickupDate, pickupTimeSlot, deliveryDate, deliveryTimeSlot, pickupAddress, pickupAddressId, pickupLandmark, pickupLat, pickupLng, pickupInstructions, createdBy } = body

    if (!businessIdInput || !storeId) {
      return NextResponse.json({ error: "Missing required fields: businessId, storeId" }, { status: 400 })
    }
    const guard = await requireLaundryPermission(request, businessIdInput, "laundry.orders.create")
    if (!guard.ok) return guard.res

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

    // Enterprise order number via the shared generator, scoped to the store:
    // ORD-{storeCode}-NNNNNN. Falls back to a business-scoped number if the
    // store has no code yet.
    const storeRow = storeId ? await prisma.laundryStore.findUnique({ where: { id: storeId }, select: { storeCode: true } }) : null
    const orderNumber = storeRow?.storeCode
      ? await generateOrderNumber(storeRow.storeCode)
      : await generateOrderNumber(laundryBusiness.businessCode)

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
    // A garment can only be ordered under a service the Pricing Matrix prices it
    // for. Refused here as well as in the UI, so a stale screen or a direct API
    // call cannot create a ₹0 line for a combination that has no price.
    const unavailable = billing ? unavailableCombinationError(billing.lines) : null
    if (unavailable) return NextResponse.json({ error: unavailable, code: "SERVICE_NOT_AVAILABLE_FOR_GARMENT" }, { status: 400 })

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

    // ── Single Order Engine: identical create path for every source ───────────
    const order = await createLaundryOrder({
      laundryBusinessId: businessId,
      storeId,
      orderNumber,
      customerId: customerId || null,
      orderType: resolvedOrderType,
      orderSource: orderSource || defaultOrderSource(resolvedOrderType),
      source: "MANUAL",
      customerType,
      lines: (billing?.lines ?? []) as never,
      serviceLines,
      financials: {
        subtotal: q?.subtotal ?? 0,
        gstTotal: q?.gstTotal ?? 0,
        pickupCharge: q?.pickupCharge ?? 0,
        deliveryCharge: q?.deliveryCharge ?? 0,
        expressCharge: q?.expressCharge ?? 0,
        discount: 0,
        grandTotal,
        balanceDue: grandTotal,
        paymentStatus: customerType === "SUBSCRIPTION" && grandTotal === 0 ? "SUBSCRIPTION" : "UNPAID",
        billed: hasItems,
      },
      isExpress: !!isExpress,
      paymentPreference: paymentPreference || "COD",
      expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : null,
      deliveryOverride: deliveryOverride || false,
      overrideReason: overrideReason || null,
      pickupRequired: pickupRequired ?? undefined,
      deliveryRequired: deliveryRequired ?? undefined,
      pickupDate: pickupDate ? new Date(pickupDate) : null,
      pickupTimeSlot: pickupTimeSlot || null,
      deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
      deliveryTimeSlot: deliveryTimeSlot || null,
      pickupAddress: pickupAddress || null,
      // The saved Address the operator chose, and its coordinates. Recording the
      // row id (not just the text) is what lets routing and the executive's map
      // use the customer's existing location instead of a re-typed string.
      pickupAddressId: pickupAddressId || null,
      pickupLandmark: pickupLandmark || null,
      pickupLat: pickupLat != null ? Number(pickupLat) : null,
      pickupLng: pickupLng != null ? Number(pickupLng) : null,
      pickupInstructions: pickupInstructions || null,
      specialInstructions: specialInstructions || null,
      notes: notes || null,
      createdBy: createdBy || null,
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

    // ── Automatic subscription consumption (integration) ──────────────────────
    // The operator never applies a subscription manually. If the customer has an
    // ACTIVE/GRACE subscription, coverage is applied here. Guarded + non-fatal:
    // a walk-in or a customer with no subscription is a no-op, and any failure
    // leaves the order at full regular price rather than blocking creation.
    let subscription: { coveredAmount: number; extraAmount: number; lines: unknown[] } | null = null
    if (customerId) {
      try {
        const applied = await applySubscriptionToOrder(order.id, { actorName: createdBy || null })
        if (applied.ok && applied.coveredAmount > 0) {
          subscription = { coveredAmount: applied.coveredAmount, extraAmount: applied.extraAmount, lines: applied.lines }
          const refreshed = await prisma.laundryOrder.findUnique({ where: { id: order.id }, select: { balanceDue: true, paymentStatus: true, amountPaid: true, subscriptionCoveredAmount: true } })
          if (refreshed) Object.assign(order, refreshed)
        }
      } catch (e) { console.error("[laundry-orders] auto subscription apply failed:", e) }
    }

    return NextResponse.json({ success: true, data: order, subscription }, { status: 201 })
  } catch (error) {
    // A mixed-service create is a client mistake, not a server fault: answer
    // 400 with the operator-facing message instead of a generic 500.
    const oneSvc = oneServiceError(error)
    if (oneSvc) return NextResponse.json({ success: false, ...oneSvc }, { status: 400 })
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
    // Stage-completion filters (used by the Barcode / Packing History tabs) —
    // based on STORED completion data, never on order status.
    // Operational queue the order is waiting in — a DERIVED view over the same
    // fields the queues themselves read. Read-only: it filters, never moves.
    const opStage = searchParams.get("opStage")
    const promise = searchParams.get("promise") // delivery-promise filter — see PROMISE_WHERE below
    const barcoded = searchParams.get("barcoded") // "1" → Barcode Generation completed (Moved to Processing)
    const packed = searchParams.get("packed")     // "1" → Packing & QR completed
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100)
    const offset = parseInt(searchParams.get("offset") || "0")

    if (!businessId) {
      return NextResponse.json({ error: "Missing businessId parameter" }, { status: 400 })
    }
    // The stage-completion feeds belong to the screen that asks for them, not to
    // the Orders module. Barcode Generation → History (barcoded=1) is a
    // Processing Center screen, and Processing Staff hold
    // `processing.audit_barcode` WITHOUT `laundry.orders` — so gating this feed
    // on the Orders permission alone returned 403 and the tab rendered empty.
    // Fall back to the owning screen's permission; every other orders query
    // keeps the Orders gate exactly as before.
    let guard = await requireLaundryPermission(request, businessId, "laundry.orders.view")
    if (!guard.ok && barcoded === "1") {
      guard = await requireLaundryPermission(request, businessId, "processing.audit_barcode.view")
    }
    if (!guard.ok) return guard.res

    const resolved = await resolveLaundryBusiness(businessId)
    if (!resolved) {
      return NextResponse.json({ success: true, data: [], total: 0, limit, offset })
    }

    const where: Record<string, unknown> = { businessId: resolved.id }
    if (status) where.status = status

    // ── OPERATIONAL STAGE FILTER ────────────────────────────────────────────
    // Translated into the SAME rule the row label uses, so the dropdown and the
    // table can never disagree. Expressed as a where-clause rather than by
    // filtering in JS, so paging and totals stay correct.
    if (opStage && opStage !== "ALL") {
      const opFilters: Record<string, unknown>[] = []
      const byStatus = STATUS_QUEUES.find((q) => q.key === opStage)
      const stages = stagesForKey(opStage)
      if (byStatus?.status) {
        opFilters.push({ status: byStatus.status })
      } else if (stages.length > 0) {
        // "Earliest stage wins": the order has a garment in THIS queue and none
        // in any earlier one. Without the `none`, an order with one garment at
        // Washing and one at Folding would answer to both queues.
        const earlier = [...new Set(stages.flatMap((st) => stagesBefore(st)))].filter((st) => !stages.includes(st))
        opFilters.push({ status: { in: ["PROCESSING", "QC_PENDING", "IN_TRANSIT_TO_PROCESSING"] } })
        opFilters.push({ items: { some: { processingStage: { in: stages } } } })
        if (earlier.length) opFilters.push({ items: { none: { processingStage: { in: earlier } } } })
      } else if (opStage === UNASSIGNED.key) {
        // At the Processing Centre with no garment stage at all.
        opFilters.push({ status: { in: ["PROCESSING", "QC_PENDING"] } })
        opFilters.push({ items: { none: { processingStage: { in: PROCESSING_QUEUES.map((q) => q.stage!).filter(Boolean) } } } })
      }
      if (opFilters.length) where.AND = [...((where.AND as unknown[]) || []), ...opFilters]
    }
    if (storeId) where.storeId = storeId
    if (customerId) where.customerId = customerId

    // ── Customer delivery promise filters ────────────────────────────────────
    // Evaluated in SQL against today so the page count and pagination stay
    // correct. These cover the LIVE states, which are the ones a counter acts
    // on; the delivered-versus-promise breakdown compares two columns to each
    // other, which Prisma cannot express, and belongs with reporting.
    if (promise) {
      const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0)
      const startOfTomorrow = new Date(startOfToday); startOfTomorrow.setDate(startOfTomorrow.getDate() + 1)
      const undelivered = { deliveredAt: null }
      const missedPrimary = {
        ...undelivered,
        promisedDeliveryDate: { lt: startOfToday },
        // Still recoverable while the backup day has not itself passed.
        OR: [{ promisedBackupDeliveryDate: null }, { promisedBackupDeliveryDate: { gte: startOfToday } }],
      }
      const missedBackup = { ...undelivered, promisedBackupDeliveryDate: { lt: startOfToday } }

      if (promise === "due_today") Object.assign(where, undelivered, { promisedDeliveryDate: { gte: startOfToday, lt: startOfTomorrow } })
      else if (promise === "on_schedule") Object.assign(where, undelivered, { promisedDeliveryDate: { gte: startOfTomorrow } })
      else if (promise === "missed_primary") Object.assign(where, missedPrimary)
      else if (promise === "missed_backup") Object.assign(where, missedBackup)
      else if (promise === "late") Object.assign(where, undelivered, { AND: [{ promisedDeliveryDate: { lt: startOfToday } }] })
      else if (promise === "tomorrow") {
        const dayAfter = new Date(startOfTomorrow); dayAfter.setDate(dayAfter.getDate() + 1)
        Object.assign(where, undelivered, { promisedDeliveryDate: { gte: startOfTomorrow, lt: dayAfter } })
      }
    }
    // Stage-completion (stored data, NOT order status): keeps an order visible in
    // the stage where it was completed even after it moves to later stages.
    //
    // Barcode Generation History matches an order that has EITHER had barcodes
    // generated OR had its route frozen by "Move to Processing Queue".
    // Previously it required processFlow alone, so an order whose garments were
    // barcoded but not yet moved matched nothing and vanished from History —
    // the operator had no way to reprint its labels. Both markers are stored
    // facts, so an order stays visible once it reaches either.
    if (barcoded === "1") {
      where.items = { some: { OR: [{ processFlow: { not: null } }, { barcodeGenerated: true }] } }
    }
    // Packing completion is a WORKFLOW fact, not a packet fact: in BAG transport
    // mode no packet row is ever created, so the PACK_ORDER audit event is the
    // portable marker. Legacy rows are matched by either.
    if (packed === "1") {
      where.AND = [
        ...((where.AND as unknown[]) || []),
        { OR: [{ packet: { isNot: null } }, { events: { some: { action: "PACK_ORDER" } } }] },
      ]
    }
    if (from || to) {
      const createdAt: Record<string, Date> = {}
      if (from) createdAt.gte = new Date(from)
      if (to) createdAt.lte = new Date(to)
      where.createdAt = createdAt
    }
    // Transport Setup decides which identifier is searchable / displayed — a
    // BAG-mode business searches and shows bag numbers, never PKT numbers.
    const transportModes = await getTransportModes(resolved.id)
    const listMode = transportModes.storeToProcessing

    if (search) {
      // Search by order number, transport identifier (bag / packet, per mode),
      // or by customer name / mobile (resolve matching platform customers, then
      // filter orders by their id).
      const [matched, transportOrderIds] = await Promise.all([
        prisma.customer.findMany({
          where: { businessId: resolved.platformBusinessId || resolved.id, OR: [{ name: { contains: search } }, { phone: { contains: search } }] },
          select: { id: true },
        }),
        orderIdsByTransportSearch(resolved.id, search, listMode),
      ])
      where.OR = [
        { orderNumber: { contains: search } },
        ...(matched.length ? [{ customerId: { in: matched.map((c) => c.id) } }] : []),
        ...(transportOrderIds.length ? [{ id: { in: transportOrderIds } }] : []),
      ]
    }

    // ── REPORT MODE ──────────────────────────────────────────────────────
    //
    // The SAME guard, the SAME resolved business and the SAME `where` the list
    // above built — so the report can never show an order the list would not,
    // and no second, looser reporting endpoint exists. Only the shape differs:
    // one row per order, enriched with the contact, money, item and bag detail
    // a printed report needs, and uncapped instead of paginated.
    if (searchParams.get("report") === "1") {
      const rows = await prisma.laundryOrder.findMany({
        where: where as never,
        include: {
          store: { select: { storeName: true } },
          services: { select: { serviceName: true } },
          items: { select: { garmentName: true, serviceName: true, quantity: true, unitPrice: true, total: true } },
          payments: { select: { method: true, status: true } },
        },
        orderBy: { createdAt: "desc" },
        take: REPORT_MAX_ROWS,
      })

      // Customer contact + address: the platform Customer the order already
      // references. No customer record is created, copied or reshaped.
      const custIds = [...new Set(rows.map((o) => o.customerId).filter(Boolean) as string[])]
      const custs = custIds.length
        ? await prisma.customer.findMany({
            where: { id: { in: custIds } },
            select: {
              id: true, name: true, phone: true, email: true, customerCode: true,
              addresses: { select: { addressLine1: true, addressLine2: true, area: true, landmark: true, city: true, state: true, pincode: true }, take: 1, orderBy: { isDefault: "desc" } },
            },
          })
        : []
      const custById = new Map(custs.map((c) => [c.id, c]))

      // Bags already assigned to these orders — the existing assignment rows.
      const bagRows = rows.length
        ? await prisma.laundryBagAssignment.findMany({
            where: { businessId: resolved.id, orderId: { in: rows.map((o) => o.id) } },
            select: { orderId: true, bag: { select: { bagNumber: true } } },
          })
        : []
      const bagsByOrder = new Map<string, string[]>()
      for (const b of bagRows) {
        if (!b.bag?.bagNumber) continue
        const list = bagsByOrder.get(b.orderId) || []
        if (!list.includes(b.bag.bagNumber)) list.push(b.bag.bagNumber)
        bagsByOrder.set(b.orderId, list)
      }

      const report = rows.map((o) => {
        const c = o.customerId ? custById.get(o.customerId) : null
        const a = c?.addresses?.[0]
        // The order's OWN address snapshot wins — it is what was agreed for this
        // job — and the customer's default address is the fallback.
        const address = o.pickupAddress
          || (a ? [a.addressLine1, a.addressLine2, a.area, a.landmark, a.city, a.state, a.pincode].filter(Boolean).join(", ") : "")
        const shaped: ReportOrder = {
          orderNumber: o.orderNumber, storeName: o.store?.storeName ?? null,
          status: o.status, orderType: o.orderType, createdAt: o.createdAt,
          // PICKUP: the order's own booking, never derived.
          pickupDate: o.pickupDate, pickupTimeSlot: o.pickupTimeSlot,
          deliveryDate: o.deliveryDate, deliveryTimeSlot: o.deliveryTimeSlot,
          customerName: c?.name ?? null, customerPhone: c?.phone ?? null,
          customerEmail: c?.email ?? null, customerCode: c?.customerCode ?? null,
          address: address || null,
          items: o.items,
          services: [...new Set(o.services.map((s) => s.serviceName).filter(Boolean))],
          subtotal: o.subtotal, discount: o.discount, gstTotal: o.gstTotal, grandTotal: o.grandTotal,
          amountPaid: o.amountPaid, balanceDue: o.balanceDue, paymentStatus: o.paymentStatus,
          paymentMethods: [...new Set(o.payments.filter((p) => p.status === "SUCCESS").map((p) => p.method).filter(Boolean))],
          bagNumbers: bagsByOrder.get(o.id) || [],
          auditedAt: o.auditedAt, deliveredAt: o.deliveredAt,
          // Carried through so the report can distinguish a system-recorded
          // completion from an attested administrative reconciliation.
          administrativelyReconciled: o.administrativelyReconciled,
          reconciliationType: o.reconciliationType,
          reconciliationReason: o.reconciliationReason,
          reconciledBy: o.reconciledBy,
        }
        return buildReportRow(shaped)
      })

      return NextResponse.json({ success: true, report, total: report.length, truncated: rows.length === REPORT_MAX_ROWS })
    }

    const [orders, total] = await Promise.all([
      prisma.laundryOrder.findMany({
        where: where as any,
        include: {
          services: true,
          store: { select: { storeName: true, storeCode: true } },
          _count: { select: { items: true } },
          // Un-inspected garments only — used to derive Store Audit completeness
          // (auditComplete) without loading every item. Usually empty. Additive.
          items: { where: { inspectedAt: null }, select: { id: true } },
          // NOTE: the packet is deliberately NOT included. Every consumer reads
          // the resolved `transport` below, so no screen can reach a PKT number
          // in a business whose Transport Setup does not use packets.
          // Customer rating & feedback (submitted once per delivered order).
          feedback: { select: { rating: true, comment: true } },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.laundryOrder.count({ where: where as any }),
    ])

    // Attach customer name/phone (platform Customer, referenced by id) + item count.
    const customerIds = [...new Set(orders.map((o) => o.customerId).filter(Boolean) as string[])]
    const customers = customerIds.length
      ? await prisma.customer.findMany({ where: { id: { in: customerIds } }, select: { id: true, name: true, phone: true, customerCode: true } })
      : []
    const custMap = new Map(customers.map((c) => [c.id, c]))
    // Transport identifier per order, resolved through Transport Setup.
    const transportRefs = await transportRefsForOrders(resolved.id, orders.map((o) => o.id), listMode)

    // Garment stages for the whole page in ONE grouped query — never per order.
    // Only the distinct (orderId, processingStage) pairs are needed, because the
    // rule is a scan for the earliest stage present, not a count.
    const stageRows = orders.length
      ? await prisma.laundryOrderItem.groupBy({
          by: ["orderId", "processingStage"],
          where: { orderId: { in: orders.map((o) => o.id) } },
        }).catch(() => [] as { orderId: string; processingStage: string | null }[])
      : []
    const stagesByOrder = new Map<string, (string | null)[]>()
    for (const r of stageRows) {
      const list = stagesByOrder.get(r.orderId) || []
      list.push(r.processingStage)
      stagesByOrder.set(r.orderId, list)
    }
    // auditComplete: has garments AND none left un-inspected (Store Audit done).
    // Drives the Packing queue filter so incomplete orders never appear there.
    const data = orders.map((o) => {
      const { items, ...rest } = o
      const auditComplete = o._count.items > 0 && (items?.length ?? 0) === 0
      const transport = transportRefs.get(o.id) || null
      // The queue this order is waiting in — the SAME pure rule the filter above
      // and the row label use, so all three agree by construction.
      const opQueue = operationalStage({ status: o.status as string, itemStages: stagesByOrder.get(o.id) || [] })
      return {
        ...rest,
        transport,
        transportCode: transport?.code || null,
        customer: o.customerId ? custMap.get(o.customerId) || null : null,
        itemCount: o._count.items,
        auditComplete,
        operationalStageKey: opQueue.key,
        operationalStage: opQueue.label,
      }
    })

    return NextResponse.json({ success: true, data, total, limit, offset, transportModes })
  } catch (error) {
    console.error("[laundry-orders] GET Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
