// POST /api/laundry/orders/[id]/deliver — the FINAL operational action.
// Customer pickup / delivery completion. SERVER-VALIDATED:
//   - order must be READY_FOR_DELIVERY
//   - outstanding balance blocks delivery (pay first via the payment API)
//     unless the order is subscription-covered
// Captures delivered by / timestamp / recipient, writes the Delivered event.
//
// Body: { businessId, actorId?, actorName?, recipientName?, note? }
import { NextResponse } from "next/server"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { markOrderDelivered } from "@/lib/laundry-deliver"
import { notifyCustomerForOrder } from "@/lib/laundry-notify"

export const runtime = "nodejs"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const b = await request.json().catch(() => ({}))
    const guard = await requireLaundryPermission(request, b.businessId, "store_ops.ready_for_delivery.operate")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(b.businessId)
    if (!biz) return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })

    const r = await markOrderDelivered({ lbId: biz.id, orderId: id, deliveredBy: b.actorName || null, recipientName: b.recipientName || null, note: b.note || null, actor: { id: b.actorId || null, name: b.actorName || null } })
    if (!r.ok) return NextResponse.json({ error: r.error, ...(r.code ? { code: r.code, balanceDue: r.balanceDue } : {}) }, { status: r.status })
    await notifyCustomerForOrder(id, biz.id, { type: "DELIVERY_UPDATE", title: "Order delivered", message: `Your order ${r.orderNumber} has been delivered.` })
    return NextResponse.json({ success: true, data: { orderNumber: r.orderNumber, deliveredAt: r.deliveredAt, deliveryType: r.deliveryType } })
  } catch (e) {
    console.error("[laundry-order-deliver] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
