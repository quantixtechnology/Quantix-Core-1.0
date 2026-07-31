// POST /api/laundry/executive/jobs/[id]/status — the executive advances a job's
// LIVE field status (Start → Navigate → Reached → Verify → Pickup In Progress →
// Pickup Completed). This updates order.fieldStatus + appends a LaundryOrderEvent
// (visible in Admin + Customer timelines). It NEVER changes the order's own
// status lifecycle — Store Receive (Admin, existing) still does that.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveExecutive, bearerToken } from "@/lib/laundry-executive-auth"
import { logFieldEvent, FIELD_STATUS, PICKUP_DONE } from "@/lib/laundry-field-ops"
import { notifyCustomerForOrder } from "@/lib/laundry-notify"
import { verifyPickup } from "@/lib/laundry-verification"

export const runtime = "nodejs"

// Field statuses an executive may set + the timeline action logged for each.
const ALLOWED: Record<string, { action: string; note: (n?: string) => string }> = {
  STARTED: { action: "PICKUP_STARTED_TRIP", note: () => "Executive started" },
  NAVIGATING: { action: "PICKUP_NAVIGATING", note: () => "Navigating to customer" },
  REACHED: { action: "PICKUP_REACHED", note: () => "Reached customer" },
  PICKUP_STARTED: { action: "PICKUP_IN_PROGRESS", note: () => "Pickup started" },
  PICKUP_COMPLETED: { action: "PICKUP_COMPLETED", note: () => "Pickup completed" },
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await resolveExecutive(bearerToken(request))
    if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    const b = await request.json().catch(() => ({}))
    const status = String(b.status || "")

    const order = await prisma.laundryOrder.findFirst({ where: { id, businessId: session.businessId }, select: { id: true, pickupExecutiveId: true, pickupAcceptance: true, fieldStatus: true, pickupOtp: true, pickupVerificationMethod: true, pickupVerifiedAt: true, services: { select: { serviceId: true, serviceName: true } } } })
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })
    if (order.pickupExecutiveId !== session.executiveId) return NextResponse.json({ error: "This pickup is not assigned to you" }, { status: 403 })
    if (order.pickupAcceptance !== "ACCEPTED") return NextResponse.json({ error: "Accept the assignment before starting the pickup" }, { status: 409 })

    // Customer verification (name or OTP) — SERVER-ENFORCED, not just logged.
    // The configured method (Workflow Settings snapshot) decides: OTP must match
    // the stored Pickup OTP (cleared on success), NAME is a recorded identity
    // confirmation. Verification is REQUIRED before the job can move on, and
    // PICKUP_COMPLETED below refuses to complete an unverified pickup.
    if (b.verify) {
      const provided = String(b.verifyValue || "").trim() || null
      const actorName = String(b.executiveName || "Executive")
      const v = await verifyPickup(session.businessId, order, provided, actorName)
      if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status })
      await logFieldEvent({ orderId: order.id, businessId: session.businessId, action: "CUSTOMER_VERIFIED", note: `Customer verified (${v.method}${v.method === "NAME" ? " — identity confirmed" : ""})`, actor: { id: session.executiveId, name: actorName } })
      await prisma.laundryOrder.update({ where: { id: order.id }, data: { fieldStatus: FIELD_STATUS.PICKUP_STARTED } })
      return NextResponse.json({ success: true })
    }

    const cfg = ALLOWED[status]
    if (!cfg) return NextResponse.json({ error: "Invalid status" }, { status: 400 })

    // Completing a pickup requires a bag on every service (one bag = one service).
    if (status === "PICKUP_COMPLETED") {
      const bags = await prisma.laundryBag.findMany({ where: { businessId: session.businessId, currentOrderId: order.id }, select: { currentServiceId: true, currentServiceName: true } })
      const covered = new Set(bags.map((bg) => bg.currentServiceId ?? bg.currentServiceName ?? ""))
      const missing = order.services.filter((s) => !covered.has(s.serviceId ?? s.serviceName ?? ""))
      if (missing.length) return NextResponse.json({ error: `Assign a bag for: ${missing.map((s) => s.serviceName).join(", ")}` }, { status: 409 })
      // Business rule: a pickup can never complete without successful verification.
      if (!order.pickupVerifiedAt) return NextResponse.json({ error: "Customer verification is required before the pickup can be completed." }, { status: 409 })
    }

    const upd: Record<string, unknown> = { fieldStatus: (FIELD_STATUS as Record<string, string>)[status] ?? status }
    if (status === "STARTED") upd.pickupStartedAt = new Date()
    if (status === "PICKUP_COMPLETED") upd.pickupCompletedAt = new Date()
    await prisma.laundryOrder.update({ where: { id: order.id }, data: upd })
    await logFieldEvent({ orderId: order.id, businessId: session.businessId, action: cfg.action, note: cfg.note(), actor: { id: session.executiveId, name: b.executiveName ?? "Executive" } })
    if (status === "PICKUP_COMPLETED") {
      // Chain of custody: the executive's confirmation ends THEIR leg only — the
      // order enters IN_TRANSIT_TO_STORE (never straight to store receipt; only the
      // store can confirm that, via bag scan). Bags travel with the executive.
      const advanced = await prisma.laundryOrder.updateMany({
        where: { id: order.id, status: "AWAITING_PICKUP_ASSIGNMENT" },
        data: { status: "IN_TRANSIT_TO_STORE" },
      })
      if (advanced.count > 0) {
        await prisma.laundryOrderEvent.create({
          data: {
            orderId: order.id, businessId: session.businessId,
            fromStatus: "AWAITING_PICKUP_ASSIGNMENT", toStatus: "IN_TRANSIT_TO_STORE", action: "PICKUP_COMPLETED",
            actorId: session.executiveId, actorName: b.executiveName ?? "Executive",
            note: "Pickup completed — garments in transit to store",
          },
        }).catch(() => null)
      }
      await prisma.laundryBag.updateMany({ where: { businessId: session.businessId, currentOrderId: order.id }, data: { status: "COLLECTED" } }).catch(() => null)
      await notifyCustomerForOrder(order.id, session.businessId, { type: "ORDER_STATUS", title: "Items picked up", message: "Your garments have been collected. They are currently on the way to our store." })
    }
    return NextResponse.json({ success: true, done: PICKUP_DONE.has(status) })
  } catch (e) {
    console.error("[executive-status] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
