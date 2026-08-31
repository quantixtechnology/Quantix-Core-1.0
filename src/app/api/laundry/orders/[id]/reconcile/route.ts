// ============================================================================
// ADMINISTRATIVE RECONCILIATION — POST /api/laundry/orders/[id]/reconcile
//
// Repairs an order the SYSTEM failed to record while the physical work was
// completed. See src/lib/laundry-reconciliation.ts for why this is an
// attestation rather than a workflow transition.
//
// WHAT THIS ENDPOINT DELIBERATELY DOES NOT DO:
//   • it does not call the workflow transition API, nor add any edge to
//     TRANSITIONS — the normal flow is byte-for-byte unchanged;
//   • it never passes allowInternal or custodyAction to guardStatusWrite, so
//     the custody protections in laundry-order-state.ts are not weakened,
//     relaxed or reachable from here;
//   • it does not write deliveredAt / deliveryCompletedAt, so a reconciled
//     order can never satisfy deliveryCompleted() and can never be mistaken
//     for a delivery the system observed;
//   • it never edits or deletes a single existing timeline row — it only
//     APPENDS one new event.
// ============================================================================
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireLaundryMember, isBusinessOwnerRole } from "@/lib/laundry-rbac"
import {
  assertReconcilable,
  reconciliationNote,
  RECONCILIATION_EVENT,
  RECONCILIATION_LABEL,
  type ReconciliationType,
} from "@/lib/laundry-reconciliation"

export const runtime = "nodejs"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const type = String(body.type || "") as ReconciliationType
    const reason = String(body.reason || "")
    const actualCompletionAt = body.actualCompletionAt ? new Date(String(body.actualCompletionAt)) : null

    const order = await prisma.laundryOrder.findUnique({
      where: { id },
      select: {
        id: true, businessId: true, orderNumber: true, status: true,
        administrativelyReconciled: true, reconciliationType: true,
      },
    })
    if (!order) return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 })

    // Authenticated MEMBER of this tenant first — the same tenant resolution
    // every laundry endpoint runs. Authority is then decided by role, not by a
    // screen permission: no staff role, however full its access, may attest to
    // an order's physical completion.
    const guard = await requireLaundryMember(request, order.businessId)
    if (!guard.ok) return guard.res

    const actor = {
      role: guard.ctx.role,
      isBusinessOwner: isBusinessOwnerRole(guard.ctx.role),
      // Platform authority is the SUPER ADMIN alone — not every platform role
      // in support mode (which includes read-only and sales roles).
      isSuperAdmin: guard.ctx.role === "QUANTIX_SUPER_ADMIN",
    }

    const verdict = assertReconcilable(order, type, reason, actor)
    if (!verdict.ok) {
      const status = verdict.code === "FORBIDDEN" ? 403 : verdict.code === "ALREADY_RECONCILED" ? 409 : 400
      return NextResponse.json({ success: false, error: verdict.error, code: verdict.code }, { status })
    }

    const fromStatus = order.status
    const actorName = guard.ctx.userName || guard.ctx.userEmail || "Administrator"
    const now = new Date()

    const updated = await prisma.$transaction(async (tx) => {
      // APPEND-ONLY. The existing history is never touched; this adds one row
      // that says an attestation was made, by whom, and why.
      await tx.laundryOrderEvent.create({
        data: {
          orderId: order.id,
          businessId: order.businessId,
          // The stage the order was stranded in is preserved on the timeline row
          // itself, not only on the order — the history has to stand alone.
          fromStatus,
          toStatus: verdict.to,
          action: RECONCILIATION_EVENT[verdict.type],
          note: reconciliationNote(verdict.type, fromStatus, reason),
          actorName,
        },
      })
      return tx.laundryOrder.update({
        where: { id: order.id },
        data: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          status: verdict.to as any,
          administrativelyReconciled: true,
          reconciliationType: verdict.type,
          reconciledFromStatus: fromStatus,
          reconciledAt: now,
          reconciledBy: actorName,
          reconciledByUserId: guard.ctx.userId,
          reconciliationReason: reason.trim(),
          // The attested date of the REAL event. deliveredAt is deliberately
          // left alone — it means "a delivery was recorded by the system".
          actualCompletionAt: actualCompletionAt && !Number.isNaN(actualCompletionAt.getTime()) ? actualCompletionAt : now,
        },
        select: {
          id: true, orderNumber: true, status: true,
          administrativelyReconciled: true, reconciliationType: true,
          reconciledFromStatus: true, reconciledAt: true, reconciledBy: true,
          reconciliationReason: true, actualCompletionAt: true,
        },
      })
    })

    console.warn(
      `[laundry-reconcile] ${order.orderNumber} ${fromStatus} → ${verdict.to} by ${actorName} (${verdict.type})`,
    )

    return NextResponse.json({
      success: true,
      data: { ...updated, label: RECONCILIATION_LABEL[verdict.type] },
    })
  } catch (e) {
    console.error("[laundry-reconcile] POST", e)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
