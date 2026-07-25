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
import { releaseSubscriptionFromOrder } from "@/lib/laundry-subscription-server"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { checkAuditComplete } from "@/lib/laundry-audit"

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
    const transition = getTransition(fromStatus, toStatus)
    if (!transition) {
      return NextResponse.json(
        { error: `Invalid transition: ${statusLabel(fromStatus)} → ${statusLabel(toStatus)}` },
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
        return NextResponse.json({ success: false, code: audit.code, message: audit.message, expected: audit.expected, audited: audit.audited }, { status: 409 })
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
