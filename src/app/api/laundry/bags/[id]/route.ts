// Reusable Bag — detail + full history; PATCH to mark Available/Damaged/Lost or
// edit notes. The Bag ID + QR are permanent; "Replace QR Label" just reprints
// the same qrValue (no data change) — never creates a duplicate bag.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { setTerminalState } from "@/lib/laundry-bag-lifecycle"

export const runtime = "nodejs"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const bag = await prisma.laundryBag.findUnique({ where: { id }, include: { assignments: { orderBy: { assignedAt: "desc" }, take: 100 } } })
    if (!bag) return NextResponse.json({ error: "Bag not found" }, { status: 404 })
    // Same key as the screen and the list API (laundry.bags).
    const guard = await requireLaundryPermission(request, bag.businessId, "laundry.bags.view")
    if (!guard.ok) return guard.res

    // Full custody chain: every physical hand-off of this bag across its orders —
    // assigned → picked up → received at store → dispatched → … — with the actor
    // (sender/receiver) and timestamp on each, so ownership is auditable end to end.
    const orderIds = [...new Set(bag.assignments.map((a) => a.orderId).filter(Boolean) as string[])]
    const CUSTODY_ACTIONS = ["BAG_ASSIGNED", "PICKUP_COMPLETED", "RECEIVE_PICKUP_AT_STORE", "RECEIVE_EXCEPTION", "RECEIVE_REJECTED", "DISPATCH_TO_PROCESSING", "RECEIVE_AT_PROCESSING", "DISPATCH_TO_STORE", "RECEIVE_AT_STORE", "MARK_DELIVERED"]
    const custody = orderIds.length
      ? await prisma.laundryOrderEvent.findMany({
          where: { orderId: { in: orderIds }, action: { in: CUSTODY_ACTIONS } },
          orderBy: { createdAt: "asc" },
          select: { id: true, orderId: true, action: true, actorName: true, note: true, createdAt: true, fromStatus: true, toStatus: true },
        })
      : []
    const orderNumberById = new Map(bag.assignments.map((a) => [a.orderId, a.orderNumber]))
    // The append-only movement log (Slice 1). Loaded ONLY here, never per row on
    // the dashboard — a list must not pull every bag's history (§20).
    const events = await prisma.laundryBagEvent.findMany({
      where: { bagId: bag.id, businessId: bag.businessId },
      orderBy: { createdAt: "desc" },
      take: 200,
    })
    // The customer currently holding it, for the Customer Master link (§11).
    const customer = bag.currentCustomerId
      ? await prisma.customer.findUnique({ where: { id: bag.currentCustomerId }, select: { id: true, name: true, phone: true } }).catch(() => null)
      : null
    const store = bag.currentStoreId
      ? await prisma.laundryStore.findUnique({ where: { id: bag.currentStoreId }, select: { id: true, storeName: true } }).catch(() => null)
      : null
    return NextResponse.json({
      success: true,
      data: {
        ...bag,
        custody: custody.map((e) => ({ ...e, orderNumber: orderNumberById.get(e.orderId) ?? null })),
        events, customer, store,
      },
    })
  } catch (e) {
    console.error("[bag] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const b = await request.json().catch(() => ({}))
    const bag = await prisma.laundryBag.findUnique({ where: { id }, select: { businessId: true, status: true, bagNumber: true } })
    if (!bag) return NextResponse.json({ error: "Bag not found" }, { status: 404 })
    const guard = await requireLaundryPermission(request, bag.businessId, "laundry.bags.manual_release")
    if (!guard.ok) return guard.res
    const actor = { id: guard.ctx?.userId ?? null, name: guard.ctx?.userName ?? "Staff", role: "ADMIN" }

    // Notes are free text and carry no lifecycle meaning.
    if (b.notes !== undefined && b.status === undefined) {
      const updated = await prisma.laundryBag.update({ where: { id }, data: { notes: b.notes || null } })
      return NextResponse.json({ success: true, data: updated })
    }

    // NO ARBITRARY STATUS EDITING (§18). A bag's state is the record of what
    // physically happened to it; letting an admin type a new one would erase
    // that. Only two states are a genuine administrative DECISION — declaring a
    // bag lost, and retiring it — and both go through the lifecycle service so
    // they land in the append-only history like every other movement.
    //
    // In particular HANDED_TO_CUSTOMER can never be flipped back by hand: a bag
    // returns to stock by being RECEIVED, with a condition, and nothing else.
    if (b.status !== undefined) {
      if (b.status !== "LOST" && b.status !== "RETIRED") {
        return NextResponse.json({
          success: false,
          error: bag.status === "HANDED_TO_CUSTOMER"
            ? `${bag.bagNumber} is with the customer. Receive it back with a condition instead of setting a status.`
            : "Bag status is set by what happens to the bag. Only Lost and Retired can be recorded here.",
          code: "LIFECYCLE_ONLY",
        }, { status: 400 })
      }
      const r = await setTerminalState({
        lbId: bag.businessId, bagId: id, state: b.status,
        reason: b.reason ? String(b.reason) : null, actor,
      })
      if (!r.ok) return NextResponse.json({ success: false, error: r.error }, { status: r.status })
      if (b.notes !== undefined) await prisma.laundryBag.update({ where: { id }, data: { notes: b.notes || null } })
      const updated = await prisma.laundryBag.findUnique({ where: { id } })
      return NextResponse.json({ success: true, data: updated })
    }

    return NextResponse.json({ success: false, error: "Nothing to update" }, { status: 400 })
  } catch (e) {
    console.error("[bag] PATCH", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
