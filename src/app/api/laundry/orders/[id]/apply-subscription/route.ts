// POST /api/laundry/orders/[id]/apply-subscription
// Applies an active customer subscription's KG/Piece allowance to an order that
// the frozen Operations Engine already created at full regular price. It only
// changes billing (ledger + coverage + reduced balance) — the order, packet,
// garments, barcodes, routing and delivery are untouched (Part 14). Idempotent.
//
// Body: { actorName?, force? }
import { NextResponse } from "next/server"
import { applySubscriptionToOrder } from "@/lib/laundry-subscription-server"

export const runtime = "nodejs"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const b = await request.json().catch(() => ({}))
    const res = await applySubscriptionToOrder(id, { actorName: b.actorName || null, force: !!b.force })
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 })
    return NextResponse.json({ success: true, data: res })
  } catch (e) {
    console.error("[laundry-apply-subscription] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
