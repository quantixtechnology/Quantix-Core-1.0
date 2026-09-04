// GET  /api/laundry/orders/[id]/payment — combined customer dues for the order
//        (laundry order charges + any linked pending subscription purchase).
// POST /api/laundry/orders/[id]/payment — record a payment, allocated across the
//        order first, then the linked subscription purchase. Supports partial.
//        The subscription (allowance) activates only when its due is FULLY paid.
//
// Body: { businessId, method, amount, reference?, note?, createdBy? }
//   method: CASH | UPI | CARD | WALLET | CREDIT | SUBSCRIPTION | PARTIAL
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { getTransitions, statusLabel } from "@/lib/laundry-workflow"
import { checkAuditComplete } from "@/lib/laundry-audit"
import { guardFinancialAdvance } from "@/lib/laundry-order-state"
import { advanceAfterPayment } from "@/lib/laundry-payment-advance"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { applyPaymentToPurchase } from "@/lib/laundry-subscription-purchase"

export const runtime = "nodejs"

const METHODS = new Set(["CASH", "UPI", "CARD", "WALLET", "CREDIT", "SUBSCRIPTION", "PARTIAL"])
const r2 = (n: number) => Math.round(n * 100) / 100

async function loadDues(orderId: string, lbId: string, platformId: string | null) {
  const order = await prisma.laundryOrder.findFirst({ where: { id: orderId, businessId: lbId }, select: { id: true, orderNumber: true, grandTotal: true, amountPaid: true, customerId: true } })
  if (!order) return null
  // A pending subscription purchase collected with this order.
  const purchase = order.customerId
    ? await prisma.subscriptionPurchase.findFirst({ where: { laundryOrderId: order.id, status: { in: ["INITIATED", "PAYMENT_PENDING"] } } })
    : null
  let planName: string | null = null
  if (purchase) { const p = await prisma.subscriptionPlan.findUnique({ where: { id: purchase.planId }, select: { name: true } }); planName = p?.name || null }
  const orderDue = r2(Math.max(0, order.grandTotal - order.amountPaid))
  const subDue = purchase ? r2(Math.max(0, purchase.amount - purchase.amountPaid)) : 0
  return { order, purchase, planName, orderDue, subDue, totalDue: r2(orderDue + subDue) }
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const businessId = new URL(request.url).searchParams.get("businessId")
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })
    const d = await loadDues(id, biz.id, biz.platformBusinessId)
    if (!d) return NextResponse.json({ error: "Order not found" }, { status: 404 })
    return NextResponse.json({ success: true, data: {
      laundryCharges: r2(d.order.grandTotal), laundryPaid: r2(d.order.amountPaid), laundryDue: d.orderDue,
      subscription: d.purchase ? { purchaseId: d.purchase.id, planName: d.planName, amount: d.purchase.amount, paid: d.purchase.amountPaid, due: d.subDue, status: "PAYMENT_PENDING" } : null,
      totalCustomerDue: d.totalDue,
    } })
  } catch (e) {
    console.error("[laundry-order-payment] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * Advance the order ONE step along the state machine's primary forward edge,
 * as part of a Pay Later decision, and record the arrangement — atomically.
 *
 * Pay Later is an approved arrangement, so payment is never what holds the
 * order. Whatever stage the decision is taken at, the order takes its next
 * defined step rather than sitting where it was.
 *
 * A FINANCIAL DECISION PERFORMS NO PHYSICAL WORK. That line used to be a comment
 * only: the edge was read from TRANSITIONS and applied whatever it was, so a
 * repeated Pay Later walked an order through `internal` edges — pickup
 * completed, packed, dispatched, received at the Processing Centre, dispatched
 * back, received at the store, and finally MARK_DELIVERED — leaving orders
 * marked Delivered with no garments, no processing and no delivery. `internal`
 * edges are now skipped outright, and the destination is additionally checked
 * against the order's own evidence by the shared state guard.
 *
 * What this does NOT do:
 *   • invent a stage — the target always comes from TRANSITIONS, never a literal
 *   • move to CANCELLED, or take a non-primary/corrective edge
 *   • take an `internal` edge: those stand for physical custody events and
 *     belong to the endpoint that actually performs them
 *   • skip the audit gate, or any other state invariant (garments identified,
 *     processing complete, delivery actually completed)
 *   • fabricate custody facts. The physical receive/dispatch endpoints still own
 *     the receiver, bag condition and exception handling.
 *
 * Returns the {from,to} actually applied, or null when no step was available.
 */
async function advanceOnPayLater(orderId: string, businessId: string, actor?: string | null, note?: string | null) {
  const order = await prisma.laundryOrder.findUnique({ where: { id: orderId }, select: { status: true } })
  if (!order) return null
  const from = String(order.status)
  const primary = getTransitions(from).find((t) => t.primary && t.to !== "CANCELLED")
  if (!primary) return null
  // A PAYMENT PERFORMS NO PHYSICAL WORK — refused here, at the payment route
  // itself, independently of the state guard below. Two protections, either one
  // sufficient: this endpoint will not ASK for a physical edge, and
  // guardFinancialAdvance is structurally incapable of GRANTING one.
  if (primary.internal || primary.custody) return null

  if (primary.action === "APPROVE_AUDIT" || primary.action === "COMPLETE_AUDIT") {
    // Same transition, same gate: a Pay Later decision taken at Store Audit
    // must not slip past the weight requirement.
    const audit = await checkAuditComplete(orderId, { requireWeight: true })
    if (!audit.ok) return null
  }

  // Server-side state guard — the destination must be supported by the order's
  // own evidence, not merely reachable on the graph.
  const verdict = await guardFinancialAdvance({ orderId, businessId, from, to: primary.to })
  if (!verdict.ok) return null

  // One transaction: the order moves and the arrangement is recorded together,
  // so a failed transition can never leave "Pay Later approved" behind on its own.
  try {
    return await prisma.$transaction(async (tx) => {
      const advanced = await tx.laundryOrder.updateMany({
        where: { id: orderId, status: from as never },
        data: { status: primary.to as never },
      })
      if (advanced.count === 0) return null
      await tx.laundryOrderEvent.create({
        data: {
          orderId, businessId, fromStatus: from, toStatus: primary.to,
          action: "PAY_LATER", actorName: actor || null,
          note: `${note || "Pay later approved"} · advanced ${statusLabel(from)} → ${statusLabel(primary.to)} on the pay-later decision`,
        },
      })
      return { from, to: primary.to }
    })
  } catch {
    return null
  }
}

// Advance PAYMENT_PENDING → READY_FOR_PROCESSING with an audit event. Fires
// when payment completes. PAY NOW behaviour is deliberately unchanged.

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { businessId, method, amount, reference, note, createdBy } = body

    if (!businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
    const guard = await requireLaundryPermission(request, businessId, "store_ops.payment_collection.operate")
    if (!guard.ok) return guard.res

    // ── Explicit pay-later decision (COD / pay-at-delivery) ──────────────────
    //
    // Pay Later is an approved payment ARRANGEMENT, not a failed payment. It
    // posts no money: amountPaid and balanceDue are left exactly as they are,
    // the order is NEVER marked PAID, and the balance stays collectable in
    // Payments & Ledger until someone actually collects it.
    //
    // This used to demand status === "PAYMENT_PENDING" and answer 409 "Order is
    // not awaiting payment (current: …)" otherwise — so recording the decision
    // from Payments & Ledger, where an order can sit at any stage, was refused
    // outright. That conflated two separate things: the DECISION (recordable
    // whenever there is a balance) and the PAYMENT_PENDING → READY_FOR_PROCESSING
    // ADVANCE (valid only at Payment Collection). They are now separate: the
    // decision is always recorded, and the order advances only when it is
    // actually parked at Payment Collection. It is never blocked either way.
    if (body.action === "PAY_LATER") {
      const bizPL = await resolveLaundryBusiness(businessId)
      if (!bizPL) return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })
      const orderPL = await prisma.laundryOrder.findFirst({ where: { id, businessId: bizPL.id }, select: { id: true, status: true, balanceDue: true } })
      if (!orderPL) return NextResponse.json({ error: "Order not found" }, { status: 404 })

      const atPaymentCollection = orderPL.status === "PAYMENT_PENDING"

      // What the order is ACTUALLY waiting for, read from the state machine.
      // Pay Later can be recorded long before Payment Collection, and when the
      // order is somewhere else the operator needs to know what moves it —
      // otherwise an approved arrangement looks like a stuck order. Derived,
      // never hardcoded, so it stays true as the workflow changes.
      const nextStepOf = (status: string) => {
        const primary = getTransitions(status).find((t) => t.primary)
        return primary ? { action: primary.action, label: primary.label } : null
      }

      // Nothing due (e.g. subscription-covered) → there is no arrangement to
      // record. Advance if it is waiting at Payment Collection, else no-op.
      if (orderPL.balanceDue <= 0) {
        const okZero = atPaymentCollection
          ? await advanceAfterPayment(orderPL.id, bizPL.id, "COLLECT_PAYMENT", createdBy, "No balance due")
          : false
        return NextResponse.json({ success: true, data: { advanced: okZero, payLater: false, balanceDue: 0, status: orderPL.status, nextStep: nextStepOf(okZero ? "READY_FOR_PROCESSING" : orderPL.status) } })
      }

      const bizRow = await prisma.laundryBusiness.findUnique({ where: { id: bizPL.id }, select: { paymentPolicy: true } })
      if (bizRow?.paymentPolicy === "ADVANCE_REQUIRED") {
        return NextResponse.json({ error: "This workspace requires advance payment — pay-later is not allowed." }, { status: 403 })
      }

      const note = `Balance ₹${orderPL.balanceDue.toFixed(2)} to collect at delivery`

      // MOVE FIRST. An arrangement recorded on an earlier attempt must NEVER be
      // the reason the order stays put — that is what left this order sitting at
      // Payment Collection: a PAY_LATER event from a previous stage matched the
      // duplicate guard, which returned before the order was ever advanced.
      // The duplicate check now governs only whether the EVENT is re-written.
      //
      // At Payment Collection this takes the existing COLLECT_PAYMENT edge
      // (PAYMENT_PENDING → READY_FOR_PROCESSING, the Packing & QR queue); from
      // anywhere else it takes that stage's own primary forward edge, read from
      // the state machine. Both write the PAY_LATER event themselves.
      const moved = atPaymentCollection
        ? ((await advanceAfterPayment(orderPL.id, bizPL.id, "PAY_LATER", createdBy, note))
            ? { from: "PAYMENT_PENDING", to: "READY_FOR_PROCESSING" }
            : null)
        : await advanceOnPayLater(orderPL.id, bizPL.id, createdBy, note)

      let alreadyArranged = false
      if (!moved) {
        // No step was available (no primary edge, or the audit gate is not met).
        // Record the arrangement once per stage so the decision is not lost, and
        // report honestly rather than claiming a move that did not happen.
        const existing = await prisma.laundryOrderEvent.findFirst({
          where: { orderId: orderPL.id, action: "PAY_LATER", fromStatus: orderPL.status },
          select: { id: true },
        })
        alreadyArranged = !!existing
        if (!existing) {
          await prisma.laundryOrderEvent.create({
            data: {
              orderId: orderPL.id, businessId: bizPL.id,
              fromStatus: orderPL.status, toStatus: orderPL.status,
              action: "PAY_LATER", actorName: createdBy || null, note,
            },
          }).catch(() => null)
        }
      }

      const finalStatus = moved?.to ?? orderPL.status
      return NextResponse.json({ success: true, data: {
        advanced: !!moved, payLater: true, alreadyArranged, balanceDue: r2(orderPL.balanceDue),
        status: finalStatus, from: moved?.from ?? orderPL.status, to: finalStatus,
        nextStep: nextStepOf(finalStatus),
      } })
    }
    if (!method || !METHODS.has(method)) return NextResponse.json({ error: "Invalid payment method" }, { status: 400 })
    const amt = Number(amount)
    if (!Number.isFinite(amt) || amt <= 0) return NextResponse.json({ error: "Amount must be greater than zero" }, { status: 400 })

    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })

    const d = await loadDues(id, biz.id, biz.platformBusinessId)
    if (!d) return NextResponse.json({ error: "Order not found" }, { status: 404 })

    // Allocation priority: laundry order charges first, then subscription due.
    const toOrder = Math.min(amt, d.orderDue)
    const toSubscription = r2(Math.min(amt - toOrder, d.subDue))

    const newPaid = r2(d.order.amountPaid + toOrder)
    const balanceDue = r2(Math.max(0, d.order.grandTotal - newPaid))
    const paymentStatus = newPaid <= 0 ? "UNPAID" : balanceDue <= 0 ? "PAID" : "PARTIAL"

    const [, updated] = await prisma.$transaction([
      prisma.laundryPayment.create({ data: { orderId: d.order.id, businessId: biz.id, method, amount: amt, reference: reference || null, note: note || `Allocated ₹${toOrder} order + ₹${toSubscription} subscription`, createdBy: createdBy || null } }),
      prisma.laundryOrder.update({ where: { id: d.order.id }, data: { amountPaid: newPaid, balanceDue, paymentStatus }, include: { payments: { orderBy: { createdAt: "desc" } } } }),
    ])

    // When the order charges are fully settled while the order sits at
    // Payment Collection, advance it into the packing queue automatically.
    if (paymentStatus === "PAID") {
      await advanceAfterPayment(d.order.id, biz.id, "COLLECT_PAYMENT", createdBy, `₹${toOrder.toFixed(2)} via ${method}${reference ? ` (${reference})` : ""}`)
    }

    // Apply the subscription portion (activates the allowance only when fully paid).
    let subscriptionResult: Record<string, unknown> | null = null
    if (d.purchase && toSubscription > 0) {
      const ap = await applyPaymentToPurchase(d.purchase.id, toSubscription)
      subscriptionResult = { purchaseId: d.purchase.id, applied: ap.applied, activated: ap.activated, subscriptionId: ap.subscriptionId, remaining: ap.remaining ?? d.subDue - toSubscription }
    } else if (d.purchase) {
      subscriptionResult = { purchaseId: d.purchase.id, applied: 0, activated: false, remaining: d.subDue }
    }

    return NextResponse.json({ success: true, data: {
      order: updated,
      allocation: { toLaundryOrder: r2(toOrder), toSubscription },
      subscription: subscriptionResult,
    } }, { status: 201 })
  } catch (e) {
    console.error("[laundry-order-payment] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
