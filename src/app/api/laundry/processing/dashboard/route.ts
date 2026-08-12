// GET /api/laundry/processing/dashboard?businessId=&from=&to=
//
// One query set for the Processing Center supervisor's screen. Every number is
// counted from the SAME tables the operational queues read — LaundryOrderItem
// .processingStage for garments, LaundryOrder.status for packages — so a KPI
// can never disagree with the screen it links to.
//
// Nothing here is invented. Where a figure cannot be derived from existing data
// it is simply absent rather than shown as zero, because a confident zero is
// worse than a gap.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { resolveLaundryBusiness } from "@/lib/laundry-business"

export const runtime = "nodejs"

// The garment stages the floor actually works, in flow order. Taken from the
// existing workstation screens — this is not a second workflow definition.
const FLOW: { key: string; label: string; page: string }[] = [
  { key: "RECEIVED", label: "Received", page: "audit-barcode" },
  { key: "SORTING", label: "Sorting", page: "ws-sorting" },
  { key: "WASH", label: "Washing", page: "ws-wash" },
  { key: "DRYCLEAN", label: "Dry Cleaning", page: "ws-dryclean" },
  { key: "QC", label: "Dry & Quality Check", page: "ws-qc" },
  { key: "IRON", label: "Ironing", page: "ws-iron" },
  { key: "FOLD", label: "Folding", page: "ws-fold" },
]
const WORKING = ["SORTING", "WASH", "DRYCLEAN", "IRON", "FOLD"]

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
      grouped, receivedOrders, readyForDispatch, completedInWindow, inTransit, workloadRaw, overdue,
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
      prisma.laundryOrder.count({ where: { ...orderScope, status: { in: ["DELIVERED", "RETURN_IN_TRANSIT", "READY_FOR_DELIVERY"] }, updatedAt: inWindow } }),
      prisma.laundryOrder.count({ where: { ...orderScope, status: "IN_TRANSIT_TO_PROCESSING" } }),
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
        kpis: {
          ordersReceived: receivedOrders,
          awaitingProcessing: stage("RECEIVED"),
          inProgress: WORKING.reduce((n, s) => n + stage(s), 0),
          qcPending: stage("QC"),
          readyForDispatch,
          completed: completedInWindow,
          inTransit,
        },
        flow: FLOW.map((f) => ({ ...f, count: stage(f.key) })),
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
