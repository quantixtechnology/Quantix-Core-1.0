// POST /api/laundry/bags/receive-at-store — Chain-of-custody store receive.
//
// The STORE (never the pickup executive) confirms that a picked-up bag physically
// arrived, by scanning the bag QR / entering the bag number. Accepts BOTH bag
// kinds: reusable LaundryBag (bagNumber/qrValue) and LaundryPickupBag (PB- code).
//
// Two-step:
//   { businessId, code }                    → PREVIEW (order, customer, executive,
//                                             pickup time, bag) for the confirm screen
//   { businessId, code, confirm, condition} → RECEIVE. condition:
//       OK | BAG_DAMAGED | SEAL_BROKEN | GARMENTS_MISSING  → received (exceptions
//         recorded on the timeline), order IN_TRANSIT_TO_STORE → PENDING_STORE_AUDIT
//       REJECT → receipt refused, order stays in transit, event logged for the
//         executive to verify. No status change.
//
// Validations: unknown code, bag with no order, wrong store, cancelled/delivered
// order, already received (idempotent). Every receive records receiver + timestamp
// on the order timeline; the customer is notified.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireStoreAdmin, resolveStoreScope } from "@/lib/laundry-store-admin-auth"
import { notifyCustomerForOrder } from "@/lib/laundry-notify"
import { releaseBagsForOrder } from "@/lib/laundry-bag-assign"

export const runtime = "nodejs"

const CONDITIONS = ["OK", "BAG_DAMAGED", "SEAL_BROKEN", "GARMENTS_MISSING", "REJECT"] as const
const CONDITION_LABEL: Record<string, string> = {
  OK: "All OK", BAG_DAMAGED: "Bag damaged", SEAL_BROKEN: "Bag seal broken", GARMENTS_MISSING: "Garments missing", REJECT: "Receipt rejected",
}
// Statuses a receive can act on. AWAITING_PICKUP_ASSIGNMENT is the legacy shape
// (orders picked up before the IN_TRANSIT_TO_STORE stage existed).
const RECEIVABLE = new Set(["IN_TRANSIT_TO_STORE", "AWAITING_PICKUP_ASSIGNMENT"])

export async function POST(request: Request) {
  try {
    const b = (await request.json().catch(() => ({}))) as { code?: string; confirm?: boolean; condition?: string; note?: string; actorName?: string }
    const code = String(b.code || "").trim()
    // Store-admin auth (same as every Store PWA endpoint): store staff resolve via
    // their LaundryAccessAssignment, a Super Admin via ?businessId&storeId. Returns
    // 401 for an unauthenticated caller BEFORE any business lookup.
    const guard = await requireStoreAdmin(request)
    if (!guard.ok) return guard.res
    const scope = await resolveStoreScope(guard.session, request)
    if (!scope) return NextResponse.json({ success: false, error: "Select a store" }, { status: 400 })
    if (!code) return NextResponse.json({ success: false, error: "code is required" }, { status: 400 })
    const lbId = scope.businessId
    const receiverStoreId = scope.storeId

    // ── Resolve the bag (reusable first, then pickup bag) ─────────────────────
    const reusable = await prisma.laundryBag.findFirst({ where: { businessId: lbId, OR: [{ bagNumber: code }, { qrValue: code }] } })
    const pickupBag = reusable ? null : await prisma.laundryPickupBag.findFirst({ where: { businessId: lbId, OR: [{ code }, { qrValue: code }] } })
    if (!reusable && !pickupBag) return NextResponse.json({ success: false, error: `No bag found for "${code}".` }, { status: 404 })

    const orderId = reusable?.currentOrderId || pickupBag?.orderId || null
    const bagNumber = reusable?.bagNumber || pickupBag?.code || code
    if (!orderId) return NextResponse.json({ success: false, error: `Bag ${bagNumber} is not assigned to any order.` }, { status: 409 })

    const order = await prisma.laundryOrder.findFirst({
      where: { id: orderId, businessId: lbId },
      select: { id: true, orderNumber: true, status: true, storeId: true, customerId: true, pickupCompletedAt: true, pickupExecutiveId: true, fieldStatus: true },
    })
    if (!order) return NextResponse.json({ success: false, error: "Order for this bag was not found." }, { status: 404 })

    // ── Validations ───────────────────────────────────────────────────────────
    if (order.status === "CANCELLED" || order.status === "DELIVERED") {
      return NextResponse.json({ success: false, error: `Order ${order.orderNumber} is ${order.status.toLowerCase()} — this bag cannot be received.` }, { status: 409 })
    }
    if (receiverStoreId && order.storeId && receiverStoreId !== order.storeId) {
      const home = await prisma.laundryStore.findUnique({ where: { id: order.storeId }, select: { storeName: true } })
      return NextResponse.json({ success: false, error: `Wrong store — bag ${bagNumber} belongs to ${home?.storeName || "another store"}.` }, { status: 409 })
    }
    if (!RECEIVABLE.has(order.status)) {
      return NextResponse.json({ success: true, alreadyReceived: true, data: { orderId: order.id, orderNumber: order.orderNumber, status: order.status }, message: `Bag ${bagNumber} was already received (order is ${order.status}).` })
    }

    const [customer, executive] = await Promise.all([
      order.customerId ? prisma.customer.findUnique({ where: { id: order.customerId }, select: { name: true, phone: true } }) : null,
      order.pickupExecutiveId ? prisma.laundryDeliveryExecutive.findUnique({ where: { id: order.pickupExecutiveId }, select: { name: true } }) : null,
    ])

    // ── Preview (no confirm) — data for the receiver's confirmation screen ────
    if (!b.confirm) {
      return NextResponse.json({ success: true, preview: true, data: {
        bag: { number: bagNumber, kind: reusable ? "REUSABLE" : "PICKUP", service: reusable?.currentServiceName || pickupBag?.serviceName || null },
        order: { id: order.id, orderNumber: order.orderNumber, status: order.status },
        customer: customer ? { name: customer.name, phone: customer.phone } : null,
        executive: executive?.name || null,
        pickupCompletedAt: order.pickupCompletedAt,
      } })
    }

    // ── Receive / Reject ──────────────────────────────────────────────────────
    const condition = String(b.condition || "OK").toUpperCase()
    if (!CONDITIONS.includes(condition as never)) return NextResponse.json({ success: false, error: "Invalid receive condition" }, { status: 400 })
    const receiver = b.actorName || "Store"

    if (condition === "REJECT") {
      await prisma.laundryOrderEvent.create({ data: {
        orderId: order.id, businessId: lbId, fromStatus: order.status, toStatus: order.status,
        action: "RECEIVE_REJECTED", actorName: receiver,
        note: `Receipt of bag ${bagNumber} rejected by ${receiver}${b.note ? ` — ${b.note}` : ""}. Returned to executive${executive?.name ? ` ${executive.name}` : ""} for verification.`,
      } }).catch(() => null)
      return NextResponse.json({ success: true, rejected: true, message: `Receipt rejected — bag stays with the executive for verification.` })
    }

    const exception = condition !== "OK"
    const now = new Date()
    // SCENARIO 1 — the customer's garments come out of the pickup bag right
    // here, so the bag is finished with this order and goes back into
    // circulation immediately. It must not stay assigned through audit, payment
    // and processing: a different bag carries the order onward.
    if (reusable) await releaseBagsForOrder(lbId, order.id).catch(() => 0)
    if (pickupBag) await prisma.laundryPickupBag.update({ where: { id: pickupBag.id }, data: { status: "RECEIVED_AT_STORE", receivedAt: now, receivedBy: receiver } }).catch(() => null)

    // Order custody: transit → store audit (atomic, only from a receivable state).
    const advanced = await prisma.laundryOrder.updateMany({ where: { id: order.id, status: { in: [...RECEIVABLE] as never[] } }, data: { status: "PENDING_STORE_AUDIT" } })
    await prisma.laundryOrderEvent.create({ data: {
      orderId: order.id, businessId: lbId, fromStatus: order.status, toStatus: "PENDING_STORE_AUDIT",
      action: exception ? "RECEIVE_EXCEPTION" : "RECEIVE_PICKUP_AT_STORE", actorName: receiver,
      note: `Bag ${bagNumber} received at store by ${receiver}${executive?.name ? ` from ${executive.name}` : ""} · ${CONDITION_LABEL[condition]}${b.note ? ` — ${b.note}` : ""}`,
    } }).catch(() => null)
    await notifyCustomerForOrder(order.id, lbId, { type: "ORDER_STATUS", title: "Received at store", message: "Your garments have been received at our store. Inspection will begin shortly." }).catch(() => null)

    return NextResponse.json({ success: true, received: true, exception, advanced: advanced.count > 0, data: { orderId: order.id, orderNumber: order.orderNumber, condition, bag: bagNumber } })
  } catch (e) {
    console.error("[bags-receive-at-store] POST", e)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
