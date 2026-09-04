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
import { advanceAfterPayment } from "@/lib/laundry-payment-advance"
import { financialSummary } from "@/lib/laundry-adjustment"
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
      // requireWeight: this IS the Audit → Payment transition. Runs BEFORE any
      // write — the status update, the timeline event and the delivery-OTP
      // side effect all happen after this returns, so a refusal leaves the
      // order exactly where it was.
      const audit = await checkAuditComplete(id, { requireWeight: true })
      if (!audit.ok) {
        console.warn(`[laundry-order-transition] blocked ${order.orderNumber} audit approval: incomplete (expected ${audit.expected}, audited ${audit.audited})`)
        // `error` as well as `message`: the two 409s on this route had different
        // shapes, so a client reading json.error got `undefined` here and showed
        // a bare "Transition failed" — hiding the one thing the operator needed
        // to know. Both keys now carry the reason.
        return NextResponse.json({ success: false, error: audit.message, code: audit.code, message: audit.message, expected: audit.expected, audited: audit.audited, totalWeightKg: audit.totalWeightKg, garmentsWithoutWeight: audit.garmentsWithoutWeight, currentStatus: fromStatus }, { status: 409 })
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

    // NOTHING LEFT TO COLLECT MEANS NOTHING TO WAIT FOR.
    //
    // Store Audit hands the order to Payment Collection, and that is right while
    // money is owed. When the balance is already nil — a subscription covered
    // the whole order, it was paid up front, or the two together settled it —
    // the queue has nothing to ask for, and leaving the order there made staff
    // "collect" ₹0 before the work could start.
    //
    // This is the same transition the payment endpoint performs, called from
    // the same shared function: the same financial guard, the same conditional
    // update, the same COLLECT_PAYMENT event. No new status, no new action, and
    // Store Audit is still required to get here — the audit gate above has
    // already run and refused an incomplete order.
    //
    // Balance comes from financialSummary, the definition Payments & Ledger
    // uses, so "settled" means the same thing on both screens. Anything still
    // owed is left exactly where it was, for staff to collect.
    let autoAdvanced = false
    if (toStatus === "PAYMENT_PENDING") {
      try {
        const money = await prisma.laundryOrder.findUnique({
          where: { id },
          select: {
            // balanceDue is the field summarise() reads as the balance. Omitting
            // it does not fail loudly — round2(undefined) is 0 — so every order
            // would look settled and an unpaid one would advance. It is required.
            grandTotal: true, amountPaid: true, balanceDue: true, discount: true,
            subscriptionCoveredAmount: true,
            adjustments: true,
          },
        })
        if (money) {
          const f = financialSummary(money as never, (money.adjustments as never) ?? [])
          if (f.balance <= 0) {
            autoAdvanced = await advanceAfterPayment(
              id, order.businessId, "COLLECT_PAYMENT", body.actorName ?? null,
              `Nothing to collect — balance ₹0 after audit (invoice ₹${f.invoiceTotal}, subscription ₹${f.subscriptionCovered}, paid ₹${f.paid})`,
            )
          }
        }
      } catch (e) {
        // Never block the audit transition on this: the order is already safely
        // at Payment Collection and staff can advance it by hand.
        console.error("[laundry-order-transition] zero-balance auto-advance failed:", e)
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
        // Where the order ACTUALLY ended up. A settled order does not stop at
        // Payment Collection, and a caller told otherwise would refresh onto a
        // queue the order has already left.
        toStatus: autoAdvanced ? "READY_FOR_PROCESSING" : toStatus,
        action: transition.action,
        autoAdvanced,
      },
    })
  } catch (error) {
    console.error("[laundry-order-transition] POST Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
