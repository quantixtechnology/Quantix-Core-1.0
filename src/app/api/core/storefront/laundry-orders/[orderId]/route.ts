// GET /api/core/storefront/laundry-orders/[orderId]
// The authenticated customer's single laundry order — details + garment-level
// items + payment history + workflow timeline. Reuses LaundryOrder /
// LaundryOrderItem / LaundryPayment and the ADMIN workflow definition
// (STATUS_META) so the customer timeline is IDENTICAL to admin. Ownership +
// tenant scoped. No new model / workflow / business logic.
import { NextResponse } from "next/server"
import { withMiddleware } from "@/lib/middleware"
import { db } from "@/lib/db"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { normalizePhone } from "@/lib/customer-identity"
import { STATUS_META, statusLabel, type LaundryOrderStatus } from "@/lib/laundry-workflow"

// Canonical order comes from the single workflow definition (insertion order of
// STATUS_META). DRAFT (pre-submit) and CANCELLED (terminal branch) are not
// customer milestones.
const TIMELINE_STATUSES: LaundryOrderStatus[] = (Object.keys(STATUS_META) as LaundryOrderStatus[])
  .filter((s) => s !== "DRAFT" && s !== "CANCELLED")

async function resolveCustomerId(userId: string, businessId: string): Promise<string[]> {
  const userRec = await db.user.findUnique({ where: { id: userId }, select: { phone: true } })
  const norm = userRec?.phone ? normalizePhone(userRec.phone) : null
  const rows = await db.customer.findMany({
    where: { businessId, OR: [{ userId }, ...(norm ? [{ phone: norm }, { phone: userRec!.phone! }] : [])] },
    select: { id: true },
  })
  return rows.map((r) => r.id)
}

export const GET = withMiddleware({ requireAuth: true, requiredRoles: ["CUSTOMER"] })(async (req, context) => {
  try {
    const params = await context?.params
    const orderId = params?.orderId as string | undefined
    if (!orderId) return NextResponse.json({ success: false, error: "orderId required" }, { status: 400 })
    const user = req.user!
    const platformId = user.businessId!
    const biz = await resolveLaundryBusiness(platformId)
    if (!biz) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 })

    const customerIds = await resolveCustomerId(user.id, platformId)
    const order = await db.laundryOrder.findFirst({
      where: { id: orderId, businessId: biz.id, customerId: { in: customerIds } },
      include: {
        store: { select: { storeName: true } },
        items: { orderBy: { itemNumber: "asc" }, select: { id: true, itemNumber: true, barcode: true, serviceName: true, garmentName: true, quantity: true, processingStage: true } },
        payments: { orderBy: { createdAt: "asc" }, select: { id: true, method: true, amount: true, reference: true, note: true, createdAt: true } },
      },
    })
    if (!order) return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 })

    const cancelled = order.status === "CANCELLED"
    const curIdx = TIMELINE_STATUSES.indexOf(order.status as LaundryOrderStatus)
    const timeline = TIMELINE_STATUSES.map((s, i) => ({
      status: s,
      label: statusLabel(s),
      done: !cancelled && curIdx >= 0 && i < curIdx,
      current: !cancelled && i === curIdx,
    }))

    // Pickup/Delivery verification — expose ONLY the currently relevant OTP.
    // The pickup OTP matters until the pickup is completed; the delivery OTP from
    // the moment the order is READY_FOR_DELIVERY. NAME-verification orders have no
    // code to share. Never leak the other (already-used / not-yet-active) OTP.
    const relevantDelivery = order.status === "READY_FOR_DELIVERY" && order.deliveryVerificationMethod !== "NAME" && !!order.deliveryOtp
    const relevantPickup = !!order.pickupRequired && !order.pickupCompletedAt && order.pickupVerificationMethod !== "NAME" && !!order.pickupOtp
    const verification = {
      pickup: {
        method: order.pickupVerificationMethod || "OTP",
        otp: relevantPickup ? order.pickupOtp : null,
        message: "Your Pickup OTP has been generated. Please share this OTP with our Pickup Executive when your order is collected.",
      },
      delivery: {
        method: order.deliveryVerificationMethod || "OTP",
        otp: relevantDelivery ? order.deliveryOtp : null,
        message: "Your Delivery OTP has been generated. Please provide this OTP to the Delivery Executive before accepting your order.",
      },
    }

    return NextResponse.json({
      success: true,
      data: {
        order: {
          id: order.id, orderNumber: order.orderNumber, status: order.status, statusLabel: statusLabel(order.status),
          cancelled, orderType: order.orderType, paymentStatus: order.paymentStatus,
          pickupDate: order.pickupDate, pickupTimeSlot: order.pickupTimeSlot, pickupAddress: order.pickupAddress,
          expectedDeliveryDate: order.expectedDeliveryDate, createdAt: order.createdAt,
          recipientName: order.recipientName,
        },
        verification,
        store: order.store ? { name: order.store.storeName } : null,
        totals: { subtotal: order.subtotal, gstTotal: order.gstTotal, discount: order.discount, grandTotal: order.grandTotal, amountPaid: order.amountPaid, balanceDue: order.balanceDue },
        items: order.items.map((it) => ({ id: it.id, itemNumber: it.itemNumber, barcode: it.barcode, serviceName: it.serviceName, garmentName: it.garmentName, quantity: it.quantity, stage: it.processingStage, stageLabel: it.processingStage ? statusLabel(it.processingStage) : null })),
        payments: order.payments.map((p) => ({ id: p.id, method: p.method, amount: p.amount, reference: p.reference, note: p.note, at: p.createdAt })),
        timeline,
      },
    })
  } catch (e) {
    console.error("[storefront-laundry-order-detail] GET", e)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
})
