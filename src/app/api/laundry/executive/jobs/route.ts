// GET /api/laundry/executive/jobs?type=pickup|delivery|completed|history
// The signed-in executive's assigned jobs. Reads the EXISTING LaundryOrder (no
// second order lifecycle) filtered by pickup/deliveryExecutiveId = this exec.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveExecutive, bearerToken } from "@/lib/laundry-executive-auth"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const session = await resolveExecutive(bearerToken(request))
    if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    const type = new URL(request.url).searchParams.get("type") || "pickup"
    const lbId = session.businessId
    const execId = session.executiveId

    // Jobs are keyed by OPERATIONAL fields (assignment + completion), NOT by order
    // status — a freshly-assigned pickup (order still at PENDING_STORE_AUDIT) must
    // appear in the executive's queue. Cancelled orders are excluded by a single
    // equality check, not a broad status NOT IN(...).
    let where: Record<string, unknown>
    if (type === "delivery") {
      where = { businessId: lbId, deliveryExecutiveId: execId, deliveryCompletedAt: null, status: "READY_FOR_DELIVERY" }
    } else if (type === "completed") {
      where = { businessId: lbId, OR: [
        { pickupExecutiveId: execId, pickupCompletedAt: { not: null } },
        { deliveryExecutiveId: execId, deliveryCompletedAt: { not: null } },
      ] }
    } else if (type === "history") {
      where = { businessId: lbId, OR: [{ pickupExecutiveId: execId }, { deliveryExecutiveId: execId }] }
    } else {
      // pickup (default): assigned to me, not yet completed, not cancelled.
      where = { businessId: lbId, pickupExecutiveId: execId, pickupCompletedAt: null, status: { not: "CANCELLED" } }
    }

    const orders = await prisma.laundryOrder.findMany({
      where,
      select: {
        id: true, orderNumber: true, status: true, fieldStatus: true, isExpress: true, customerId: true,
        pickupDate: true, pickupTimeSlot: true, pickupAddress: true, pickupLandmark: true, pickupMapsLink: true, pickupLat: true, pickupLng: true,
        expectedDeliveryDate: true, deliveryDate: true, deliveryTimeSlot: true, deliveredAt: true, pickupAcceptance: true, deliveryAcceptance: true,
        deliveryBagNumber: true,
        services: { select: { serviceId: true, serviceName: true } },
        _count: { select: { items: true } },
      },
      orderBy: [{ pickupDate: "asc" }, { createdAt: "asc" }],
      take: type === "history" ? 80 : 200,
    })

    const orderIds = orders.map((o) => o.id)
    const custIds = [...new Set(orders.map((o) => o.customerId).filter(Boolean) as string[])]
    const [custs, bags] = await Promise.all([
      prisma.customer.findMany({ where: { id: { in: custIds } }, select: { id: true, name: true, phone: true } }),
      prisma.laundryBag.findMany({ where: { businessId: lbId, currentOrderId: { in: orderIds } }, select: { currentOrderId: true, currentServiceId: true, currentServiceName: true, bagNumber: true } }),
    ])
    const custMap = new Map(custs.map((c) => [c.id, c]))
    // order → serviceKey → bagNumber
    const bagByOrderSvc = new Map<string, string>()
    for (const bg of bags) {
      if (!bg.currentOrderId) continue
      const key = `${bg.currentOrderId}::${bg.currentServiceId ?? bg.currentServiceName ?? ""}`
      bagByOrderSvc.set(key, bg.bagNumber)
    }

    const data = orders.map((o) => {
      const cust = o.customerId ? custMap.get(o.customerId) : null
      const services = o.services.map((s) => ({
        serviceId: s.serviceId, serviceName: s.serviceName,
        bagNumber: bagByOrderSvc.get(`${o.id}::${s.serviceId ?? s.serviceName ?? ""}`) ?? null,
      }))
      return {
        id: o.id, orderNumber: o.orderNumber, status: o.status, fieldStatus: o.fieldStatus,
        acceptance: type === "delivery" ? o.deliveryAcceptance : o.pickupAcceptance,
        priority: o.isExpress ? "EXPRESS" : "NORMAL",
        customerName: cust?.name ?? "—", customerPhone: cust?.phone ?? null,
        timeSlot: type === "delivery" ? [o.deliveryDate ? new Date(o.deliveryDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : null, o.deliveryTimeSlot].filter(Boolean).join(" · ") || null : o.pickupTimeSlot,
        address: o.pickupAddress, landmark: o.pickupLandmark, mapsLink: o.pickupMapsLink, lat: o.pickupLat, lng: o.pickupLng,
        deliveryBagNumber: o.deliveryBagNumber ?? null,
        services, bagCount: services.length, assignedBags: services.filter((s) => s.bagNumber).length, itemCount: o._count.items,
      }
    })
    return NextResponse.json({ success: true, data })
  } catch (e) {
    console.error("[executive-jobs] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
