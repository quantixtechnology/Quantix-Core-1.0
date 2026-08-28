// ============================================================================
// POST /api/laundry/orders/[id]/transition
// Move an order to the next workflow stage. Validates the transition against
// the workflow state machine, updates the order status, and writes a
// LaundryOrderEvent (audit trail / timeline) in a single transaction.
//
// Body: { toStatus: string, note?: string, actorId?: string, actorName?: string }
// ============================================================================

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getTransition, statusLabel } from "@/lib/laundry-workflow"
import { guardStatusWrite } from "@/lib/laundry-order-state"
import { releaseSubscriptionFromOrder } from "@/lib/laundry-subscription-server"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { checkAuditComplete } from "@/lib/laundry-audit"
import { ensureDeliveryVerification } from "@/lib/laundry-verification"
import { notifyDeliveryOtpGenerated } from "@/lib/laundry-notify"

export const runtime = "nodejs"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = (await request.json().catch(() => ({}))) as {
      toStatus?: string; note?: string; actorId?: string; actorName?: string
    }
    const toStatus = body.toStatus

    if (!toStatus) {
      return NextResponse.json({ error: "toStatus is required" }, { status: 400 })
    }

    const order = await prisma.laundryOrder.findUnique({
      where: { id },
      select: { id: true, status: true, businessId: true, orderNumber: true },
    })
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }
    const guard = await requireLaundryPermission(request, order.businessId, toStatus === "CANCELLED" ? "laundry.orders.cancel" : "laundry.orders.edit")
    if (!guard.ok) return guard.res

    const fromStatus = order.status as string

    // Already there. A double-click (or a retry after a dropped response) sent
    // the SAME transition twice: the first moved the order, the second found no
    // edge from the new status and answered 409 "Invalid transition", which
    // reads like a workflow error on an order that is in fact fine. Answering
    // with the current state is both honest and idempotent. This is not a
    // workflow jump — nothing moves — so the guards below still own every real
    // transition.
    if (fromStatus === toStatus) {
      return NextResponse.json({
        success: true, data: { id, status: fromStatus, orderNumber: order.orderNumber }, alreadyInStatus: true,
      })
    }

    const transition = getTransition(fromStatus, toStatus)
    if (!transition) {
      // Name the stage the order is ACTUALLY in. A refusal here almost always
      // means the order moved underneath the screen the operator is looking at,
      // and "Invalid transition" alone gave them nothing to act on.
      return NextResponse.json(
        {
          success: false,
          error: `This order is at ${statusLabel(fromStatus)} — it cannot move to ${statusLabel(toStatus)} from there.`,
          message: `This order is at ${statusLabel(fromStatus)} — it cannot move to ${statusLabel(toStatus)} from there.`,
          code: "INVALID_TRANSITION",
          currentStatus: fromStatus,
        },
        { status: 409 },
      )
    }
    // Audit gate: an order may only LEAVE Store Audit once every garment has been
    // identified & inspected. This keeps incomplete orders in Store Audit so they
    // never reach Payment / Packing & QR. No override.
    if (transition.action === "APPROVE_AUDIT" || transition.action === "COMPLETE_AUDIT") {
      const audit = await checkAuditComplete(id)
      if (!audit.ok) {
        console.warn(`[laundry-order-transition] blocked ${order.orderNumber} audit approval: incomplete (expected ${audit.expected}, audited ${audit.audited})`)
        // `error` as well as `message`: the two 409s on this route had different
        // shapes, so a client reading json.error got `undefined` here and showed
        // a bare "Transition failed" — hiding the one thing the operator needed
        // to know. Both keys now carry the reason.
        return NextResponse.json({ success: false, error: audit.message, code: audit.code, message: audit.message, expected: audit.expected, audited: audit.audited, currentStatus: fromStatus }, { status: 409 })
      }
    }

    // Side-effect transitions (payment, packet, transit legs, delivery) must go
    // through their dedicated endpoints — the generic transition API cannot
    // skip the operational action.
    if (transition.internal) {
      return NextResponse.json(
        { error: `"${transition.label}" must be performed from its workflow screen — it records operational data, not just a status.` },
        { status: 403 },
      )
    }

    // STATE INVARIANTS — the edge says the workflow allows the move; this says
    // the order's own evidence supports the destination. Garments identified
    // before Payment/Packing/Processing, processing genuinely complete before
    // Ready for Delivery, and DELIVERED only from a real delivery completion.
    // Cancellation is a decision, not a workflow claim, so it is exempt.
    if (toStatus !== "CANCELLED") {
      const gate = await guardStatusWrite({ orderId: id, businessId: order.businessId, from: fromStatus, to: toStatus })
      if (!gate.ok) {
        console.warn(`[laundry-order-transition] blocked ${order.orderNumber} ${fromStatus} → ${toStatus}: ${gate.code}`)
        return NextResponse.json({ success: false, error: gate.error, message: gate.error, code: gate.code, currentStatus: fromStatus }, { status: 409 })
      }
    }

    // Advance the status (must succeed) ...
    const updated = await prisma.laundryOrder.update({
      where: { id },
      data: { status: toStatus as never },
    })

    // Subscription integration: cancelling an order before processing restores
    // its consumed allowance (reversal ledger entries; history preserved).
    // Guarded + non-fatal — a no-op for orders without subscription coverage.
    if (toStatus === "CANCELLED") {
      try { await releaseSubscriptionFromOrder(id, { actorName: body.actorName ?? null, reason: "Order cancelled — allowance restored" }) }
      catch (e) { console.error("[laundry-order-transition] subscription release failed:", e) }
    }

    // Delivery verification (Workflow Settings): when the order becomes
    // READY_FOR_DELIVERY, snapshot the method and generate the Delivery OTP.
    // Best-effort — a failure must NEVER block the transition; the admin can
    // regenerate from the order screen. The in-app ping is also non-fatal.
    if (toStatus === "READY_FOR_DELIVERY") {
      try {
        const dv = await ensureDeliveryVerification(order.businessId, id)
        if (dv.method === "OTP" && dv.otp) {
          await notifyDeliveryOtpGenerated(id, order.businessId, dv.otp)
        }
      } catch (e) {
        console.error("[laundry-order-transition] delivery verification init failed:", e)
      }
    }

    // ... then record the audit event (best-effort: never block the workflow if
    // the LaundryOrderEvent table hasn't been migrated on this environment yet).
    await prisma.laundryOrderEvent.create({
      data: {
        orderId: id,
        businessId: order.businessId,
        fromStatus,
        toStatus,
        action: transition.action,
        actorId: body.actorId ?? null,
        actorName: body.actorName ?? null,
        note: body.note ?? null,
      },
    }).catch((e) => console.error("[laundry-order-transition] audit event write failed:", e))

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        orderNumber: order.orderNumber,
        fromStatus,
        toStatus,
        action: transition.action,
      },
    })
  } catch (error) {
    console.error("[laundry-order-transition] POST Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
