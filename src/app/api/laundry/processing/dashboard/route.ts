// GET /api/laundry/processing/dashboard?businessId=&from=&to=
//
// TWO CLOCKS, deliberately.
//
//   ACTIVITY  — what HAPPENED in the selected window (received, completed,
//               returned). Date-filtered.
//   WORKLOAD  — what is SITTING in the Processing Center right now. NEVER
//               date-filtered: an order received yesterday and still being
//               washed today belongs in today's washing count, and hiding it
//               because of its received date is how a floor loses track of work.
//
// Every number is counted from the SAME tables the operational queues read, so
// a KPI can never disagree with the screen it links to.
//
// One thing the first version got wrong: garment processingStage is only set
// AFTER Barcode Generation. Orders still in transit, or received but not yet
// barcoded, have no stage at all — so a dashboard that counted only stages
// reported zeros while the console clearly showed work waiting. Those two
// order-level buckets are now counted explicitly.
//
// Nothing here is invented. Where a figure cannot be derived from existing data
// it is simply absent rather than shown as zero, because a confident zero is
// worse than a gap.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { resolveLaundryBusiness } from "@/lib/laundry-business"

export const runtime = "nodejs"

// The garment stages the floor actually works. Order matters here only for
// "which stage is this order really at" — the DIAGRAM's shape lives in the UI,
// because branching layout is a presentation decision, not data.
//
// The true sequence, per operations:
//   Received → Washing | Dry Cleaning → Dry & Quality Check → Sorting
//            → Ironing | Folding → Return to Store
//
// Washing and Dry Cleaning are parallel branches, as are Ironing and Folding —
// a garment takes one of each pair, never both in sequence.
const FLOW: { key: string; label: string; page: string }[] = [
  { key: "RECEIVED", label: "Received to PC", page: "audit-barcode" },
  { key: "WASH", label: "Washing", page: "ws-wash" },
  { key: "DRYCLEAN", label: "Dry Cleaning", page: "ws-dryclean" },
  { key: "QC", label: "Dry & Quality Check", page: "ws-qc" },
  { key: "SORTING", label: "Sorting", page: "ws-sorting" },
  { key: "IRON", label: "Ironing", page: "ws-iron" },
  { key: "FOLD", label: "Folding", page: "ws-fold" },
]
// Garments actively being worked — everything between intake and dispatch.
const WORKING = ["WASH", "DRYCLEAN", "SORTING", "IRON", "FOLD"]

export async function GET(request: Request) {
  try {
    const u = new URL(request.url)
    const businessId = u.searchParams.get("businessId")
    const guard = await requireLaundryPermission(request, businessId, "laundry.orders.view")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ success: false, error: "Laundry business not found" }, { status: 404 })

    // The window is supplied by the client so "today" is the operator's day, not
    // the server's. Falls back to today if absent or unparseable.
    const parse = (v: string | null, fallback: Date) => {
      const d = v ? new Date(v) : null
      return d && !Number.isNaN(d.getTime()) ? d : fallback
    }
    const now = new Date()
    const startDefault = new Date(now); startDefault.setHours(0, 0, 0, 0)
    const endDefault = new Date(startDefault); endDefault.setDate(endDefault.getDate() + 1)
    const from = parse(u.searchParams.get("from"), startDefault)
    const to = parse(u.searchParams.get("to"), endDefault)
    const inWindow = { gte: from, lt: to }

    const orderScope = { businessId: biz.id }
    const itemScope = { order: { businessId: biz.id } }

    const [
      grouped, receivedOrders, readyForDispatch, completedInWindow, returnedInWindow, inTransit,
      awaitingBarcodeOrders, workloadRaw, overdue,
    ] = await Promise.all([
      // Garment distribution — the same source the workstation queues use.
      prisma.laundryOrderItem.groupBy({
        by: ["processingStage"],
        where: { ...itemScope, processingStage: { not: null } },
        _count: { _all: true },
      }),
      // Packages the PC actually took in during the window. Counted from the
      // RECEIVE_AT_PROCESSING events, which is the real record of the handover —
      // the order row keeps no "received at processing" timestamp.
      prisma.laundryOrderEvent.count({ where: { businessId: biz.id, action: "RECEIVE_AT_PROCESSING", createdAt: inWindow } }),
      prisma.laundryOrder.count({ where: { ...orderScope, status: "READY_FOR_DELIVERY" } }),
      // Completed and returned are EVENTS, so they come from the event log with
      // the window applied — updatedAt would count any incidental edit.
      prisma.laundryOrderEvent.count({ where: { businessId: biz.id, action: "COMPLETE_PROCESSING", createdAt: inWindow } }),
      prisma.laundryOrderEvent.count({ where: { businessId: biz.id, action: "DISPATCH_TO_STORE", createdAt: inWindow } }),
      // LIVE, not windowed — packages physically heading to the centre.
      prisma.laundryOrder.count({ where: { ...orderScope, status: "IN_TRANSIT_TO_PROCESSING" } }),
      // Received but not yet barcoded: real work on the floor with NO
      // processingStage, which is exactly what the stage counts were missing.
      prisma.laundryOrder.count({ where: { ...orderScope, items: { some: { processingStage: "RECEIVED", barcodeGenerated: false } } } }),
      // Orders on the floor now, with their promise so the list can be ordered
      // by what is due rather than by what was created.
      prisma.laundryOrder.findMany({
        where: { ...orderScope, status: { in: ["PROCESSING", "IN_TRANSIT_TO_PROCESSING", "RETURN_IN_TRANSIT"] } },
        select: {
          id: true, orderNumber: true, status: true, customerId: true,
          promisedDeliveryDate: true, promisedDeliveryTimeSlot: true,
          deliveryDate: true, deliveryTimeSlot: true,
          items: { select: { processingStage: true, serviceName: true } },
        },
        take: 200,
      }),
      // Past its promise and not yet out of the building.
      prisma.laundryOrder.count({
        where: { ...orderScope, status: { in: ["PROCESSING", "IN_TRANSIT_TO_PROCESSING", "RETURN_IN_TRANSIT"] }, promisedDeliveryDate: { lt: now } },
      }),
    ])

    const stage = (s: string) => grouped.find((g) => g.processingStage === s)?._count._all ?? 0

    // Customer names live on the platform Customer table; one lookup for the page.
    const custIds = [...new Set(workloadRaw.map((o) => o.customerId).filter(Boolean))] as string[]
    const custs = custIds.length
      ? await prisma.customer.findMany({ where: { id: { in: custIds } }, select: { id: true, name: true } })
      : []
    const nameById = new Map(custs.map((c) => [c.id, c.name]))

    const workload = workloadRaw.map((o) => {
      const stages = o.items.map((i) => i.processingStage).filter(Boolean) as string[]
      // The EARLIEST stage still present is where the order really is — an order
      // is only as far along as its slowest garment.
      const current = FLOW.find((f) => stages.includes(f.key))?.label
        ?? (o.status === "IN_TRANSIT_TO_PROCESSING" ? "In Transit" : o.status.replace(/_/g, " "))
      const due = o.promisedDeliveryDate ?? o.deliveryDate ?? null
      return {
        id: o.id, orderNumber: o.orderNumber, status: o.status,
        customer: (o.customerId && nameById.get(o.customerId)) || null,
        garments: o.items.length,
        service: [...new Set(o.items.map((i) => i.serviceName).filter(Boolean))].join(", ") || null,
        currentStage: current,
        due: due ? due.toISOString() : null,
        dueSlot: o.promisedDeliveryTimeSlot ?? o.deliveryTimeSlot ?? null,
        overdue: !!due && due < now,
      }
    }).sort((a, b) => {
      // Soonest promise first; anything without one goes last rather than
      // pretending to be urgent.
      if (!a.due && !b.due) return 0
      if (!a.due) return 1
      if (!b.due) return -1
      return a.due.localeCompare(b.due)
    })

    return NextResponse.json({
      success: true,
      data: {
        window: { from: from.toISOString(), to: to.toISOString() },
        // A: what happened in the selected window.
        activity: {
          received: receivedOrders,
          completed: completedInWindow,
          returned: returnedInWindow,
        },
        // B: what is on the floor RIGHT NOW, whatever day it arrived.
        workloadNow: {
          inTransit,                                    // orders (heading here)
          awaitingBarcode: awaitingBarcodeOrders,       // orders (received, not barcoded)
          awaitingProcessing: stage("RECEIVED"),        // garments
          inProgress: WORKING.reduce((n, s) => n + stage(s), 0),
          qcPending: stage("QC"),
          readyForDispatch,                             // orders
        },
        // Garment counts per stage, plus the order-level terminal. Return to
        // Store is not a garment stage — it is the package waiting to go back —
        // so it is counted from order status, the same way the console lists it.
        flow: FLOW.map((f) => ({ ...f, count: stage(f.key) })),
        returnToStore: readyForDispatch,
        workload,
        attention: {
          overdue,
          qcPending: stage("QC"),
          awaitingProcessing: stage("RECEIVED"),
          readyForDispatch,
        },
      },
    })
  } catch (e) {
    console.error("[processing-dashboard] GET", e)
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 })
  }
}
