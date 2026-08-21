// POST /api/laundry/executive/jobs/[id]/assign-bag — scan a reusable bag and
// assign it to a service on this order. Reuses the SHARED bag-assignment engine
// (assignBagToOrder) — the exact same logic the Admin uses. A service may span
// MULTIPLE bags (unlimited); a bag can never be assigned twice or to two orders.
// Also logs the scan to the timeline. The live field status is nudged to
// "pickup in progress" ONLY from the REACHED step — bag scanning can happen
// earlier, but it never skips the mandatory customer-verification step.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveExecutive, bearerToken } from "@/lib/laundry-executive-auth"
import { assignBagToOrder, releaseBagWithAudit } from "@/lib/laundry-bag-assign"
import { prisma as db } from "@/lib/prisma"
import { receiveReturnedBag, BAG_STATUS, BAG_CONDITION, CUSTODIAN } from "@/lib/laundry-bag-lifecycle"
import { logFieldEvent, FIELD_STATUS } from "@/lib/laundry-field-ops"

export const runtime = "nodejs"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await resolveExecutive(request)
    if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    const b = await request.json().catch(() => ({}))
    const code = String(b.code || b.bagNumber || b.qrValue || "").trim()
    // A BAG IS IDENTIFIED BY ITS QR, NEVER BY ITS AVAILABILITY.
    //
    // This used to accept { useNewBag: true } and pick the lowest-numbered
    // AVAILABLE bag itself, so a doorstep could never dead-end. But executives
    // carry no printer: every physical bag is already tagged, and choosing one
    // by sequence records a number that may not be the bag in the van. Once the
    // record and the physical bag diverge, every later step trusts the wrong one.
    //
    // The guard lives HERE, not only in the app: a client that forgets to scan
    // must be refused, not accommodated.
    if (!code) {
      return NextResponse.json(
        { error: "Scan the bag's QR code — a bag cannot be assigned without it." },
        { status: 400 },
      )
    }

    const order = await prisma.laundryOrder.findFirst({ where: { id, businessId: session.businessId }, select: { id: true, pickupExecutiveId: true, fieldStatus: true, customerId: true, storeId: true } })
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })
    if (order.pickupExecutiveId !== session.executiveId) return NextResponse.json({ error: "This pickup is not assigned to you" }, { status: 403 })

    // ── The bag the customer just handed back ────────────────────────────────
    // A bag that went home with a customer is HANDED_TO_CUSTOMER, not AVAILABLE,
    // so assigning it straight to the new order would be rejected. Take it back
    // FIRST — through the same lifecycle service the Admin uses, so the return
    // is recorded with its custody change and event — and only then assign it.
    //
    // The executive is never asked to grade the bag. Condition GOOD is what
    // "the executive accepted it at the door" means; anything else is a decision
    // for whoever inspects it at the store, and the Admin can still change it.
    const scanned = code
      ? await db.laundryBag.findFirst({
          where: { businessId: session.businessId, OR: [{ bagNumber: code }, { qrValue: code }] },
          select: { id: true, status: true },
        })
      : null

    if (scanned?.status === BAG_STATUS.HANDED_TO_CUSTOMER) {
      const back = await receiveReturnedBag({
        lbId: session.businessId, bagId: scanned.id, condition: BAG_CONDITION.GOOD,
        orderId: order.id, customerId: order.customerId, storeId: order.storeId,
        receivedByCustodian: CUSTODIAN.DELIVERY_EXECUTIVE,
        reason: "Returned by customer at pickup",
        actor: { id: session.executiveId, name: b.executiveName ?? "Executive", role: "DELIVERY_EXECUTIVE" },
      })
      if (!back.ok) {
        // It is someone else's bag, or otherwise not reusable. The executive is
        // not the person to sort that out at a doorstep — they are told to use a
        // new bag, and the bag's own record is left exactly as it was for Admin.
        return NextResponse.json({ success: false, error: "That bag cannot be used for this pickup — scan a different one." }, { status: 409 })
      }
    }

    const r = await assignBagToOrder({ lbId: session.businessId, code, orderId: order.id, serviceId: b.serviceId ? String(b.serviceId) : null, serviceName: b.serviceName })
    // Any rejection at this point is still not the executive's problem to solve:
    // offer the one action that always works.
    if (!r.ok) return NextResponse.json({ success: false, error: r.error }, { status: r.status })

    // Safety: only promote REACHED → PICKUP_STARTED. Bags may be scanned before
    // the executive reaches the customer, but the field status must NEVER jump
    // past the verification step — PICKUP_COMPLETED still requires pickupVerifiedAt.
    if (order.fieldStatus === "REACHED") {
      await prisma.laundryOrder.update({ where: { id: order.id }, data: { fieldStatus: FIELD_STATUS.PICKUP_STARTED } })
    }
    await logFieldEvent({ orderId: order.id, businessId: session.businessId, action: "BAG_ASSIGNED", note: `${b.serviceName || "Service"}: ${r.bag.bagNumber}`, actor: { id: session.executiveId, name: b.executiveName ?? "Executive" } })
    return NextResponse.json({ success: true, bagNumber: r.bag.bagNumber })
  } catch (e) {
    console.error("[executive-assign-bag] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * DELETE — take a bag back off this pickup, before it is confirmed.
 *
 * A bag gets attached by scanning the wrong QR, or by "Use New Bag" picking one
 * that is not the bag actually in the executive's hand. Until now the only way
 * back was to confirm a pickup known to be wrong and have the store unpick it,
 * which puts a bad record into every downstream step.
 *
 * Deliberately narrow. It releases through the SAME audited path the Admin uses
 * — the release is recorded, not erased — and it refuses once the pickup has
 * been verified, because after that the bag is a fact about a completed
 * collection rather than a choice still being made.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await resolveExecutive(request)
    if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

    const b = await request.json().catch(() => ({}))
    const code = String(b.code || b.bagNumber || "").trim()
    if (!code) return NextResponse.json({ error: "Which bag?" }, { status: 400 })

    const order = await prisma.laundryOrder.findFirst({
      where: { id, businessId: session.businessId },
      select: { id: true, pickupExecutiveId: true, pickupCompletedAt: true, storeId: true },
    })
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })
    if (order.pickupExecutiveId !== session.executiveId) {
      return NextResponse.json({ error: "This pickup is not assigned to you" }, { status: 403 })
    }
    // Locked by CONFIRMATION, not by verification.
    //
    // pickupVerifiedAt is stamped when the customer proves who they are — at
    // the REACHED step, BEFORE any bag is scanned. Gating on it locked the bag
    // list at the very moment the executive was starting to fill it, so the
    // remove button was refused on the screen that exists to edit bags.
    //
    // pickupCompletedAt is what "Confirm Pickup" sets, which is the point after
    // which the bags are a fact about a finished collection rather than a
    // choice still being made.
    if (order.pickupCompletedAt) {
      return NextResponse.json({ error: "Pickup is already confirmed. Ask the store to change the bag." }, { status: 409 })
    }

    // The bag must be on THIS order — an executive cannot free somebody else's.
    const bag = await db.laundryBag.findFirst({
      where: { businessId: session.businessId, currentOrderId: order.id, OR: [{ bagNumber: code }, { qrValue: code }] },
      select: { id: true, bagNumber: true },
    })
    if (!bag) return NextResponse.json({ error: "That bag is not on this pickup." }, { status: 404 })

    const r = await releaseBagWithAudit({
      lbId: session.businessId,
      bagId: bag.id,
      code: bag.bagNumber,
      storeId: order.storeId,
      releasedBy: session.executiveId,
      releaseType: "MANUAL",
      reason: "Removed by executive before pickup was confirmed",
    })
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })

    await logFieldEvent({
      orderId: order.id, businessId: session.businessId, action: "BAG_REMOVED",
      note: `${b.serviceName || "Service"}: ${bag.bagNumber} removed before confirmation`,
      actor: { id: session.executiveId, name: b.executiveName ?? "Executive" },
    })
    return NextResponse.json({ success: true, bagNumber: bag.bagNumber })
  } catch (e) {
    console.error("[executive-assign-bag] DELETE", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
