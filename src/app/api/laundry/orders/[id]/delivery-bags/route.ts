// GET  /api/laundry/orders/[id]/delivery-bags?businessId= — the order's final
//      bag set with per-bag scan / exception state.
// POST /api/laundry/orders/[id]/delivery-bags { businessId, code } — scan one.
// POST … { businessId, action: "exception", code, reason, note? } — record that
//      one bag could not physically be scanned.
//
// The COUNTER equivalent of the executive route. Ready for Delivery completes
// hand-overs through /orders/[id]/deliver, which is gated by deliveryBagGate();
// without this route that gate would have no way to be satisfied at the counter,
// and a torn label would strand the order — the exact stranding the exception
// exists to prevent.
//
// Thin transport over the already-tested domain layer: tenant, order membership,
// duplicate handling, reason validation and the N-of-M gate all live in
// deliveryBags()/confirmDeliveryBag()/recordDeliveryBagException(). Guarded with
// the SAME permission as the delivery it unblocks — no new authority.
import { NextResponse } from "next/server"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { deliveryBags, confirmDeliveryBag, recordDeliveryBagException } from "@/lib/laundry-delivery-bags"

export const runtime = "nodejs"

const PERMISSION = "store_ops.ready_for_delivery.operate"

async function guard(request: Request, businessId: string) {
  const g = await requireLaundryPermission(request, businessId, PERMISSION)
  if (!g.ok) return { error: g.res }
  const biz = await resolveLaundryBusiness(businessId)
  if (!biz) return { error: NextResponse.json({ error: "Laundry business not found" }, { status: 404 }) }
  return { biz }
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const businessId = new URL(request.url).searchParams.get("businessId") || ""
    const g = await guard(request, businessId)
    if ("error" in g) return g.error
    return NextResponse.json({ success: true, data: await deliveryBags(g.biz.id, id) })
  } catch (e) {
    console.error("[order-delivery-bags] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const b = await request.json().catch(() => ({}))
    const g = await guard(request, String(b.businessId || ""))
    if ("error" in g) return g.error

    const code = String(b.code || b.bagNumber || b.qrValue || "")
    const actor = { id: b.actorId ?? null, name: b.actorName ?? null, role: "STORE" }

    const res = String(b.action || "") === "exception"
      ? await recordDeliveryBagException({ lbId: g.biz.id, orderId: id, code, reason: b.reason, note: b.note, actor })
      : await confirmDeliveryBag({ lbId: g.biz.id, orderId: id, code, actor })

    if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status })

    // Always answer with the server's own view — the client never computes progress.
    return NextResponse.json({
      success: true,
      data: {
        ...await deliveryBags(g.biz.id, id),
        scanned: res.bagNumber,
        alreadyConfirmed: "alreadyConfirmed" in res ? res.alreadyConfirmed : false,
        alreadyExcepted: "alreadyExcepted" in res ? res.alreadyExcepted : false,
      },
    })
  } catch (e) {
    console.error("[order-delivery-bags] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
