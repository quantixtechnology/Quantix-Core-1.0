// POST /api/laundry/subscriptions/[id]/renewal
// Subscription lifecycle actions (Part 11) + manual ledger adjustment (Part 8).
// Body: { action, unit?, delta?, note?, actorName? }
//   action ∈ renew | expire | suspend | resume | cancel | adjust
import { NextResponse } from "next/server"
import { renewSubscription, processExpiry, suspendSubscription, resumeSubscription, cancelSubscription, manualAdjust } from "@/lib/laundry-subscription-renewal"

export const runtime = "nodejs"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const b = await request.json().catch(() => ({}))
    const action = String(b.action || "").toLowerCase()
    const actorName = b.actorName || null

    let res
    switch (action) {
      case "renew": res = await renewSubscription(id, { actorName, manual: true }); break
      case "expire": res = await processExpiry(id, { actorName }); break
      case "suspend": res = await suspendSubscription(id, actorName); break
      case "resume": res = await resumeSubscription(id); break
      case "cancel": res = await cancelSubscription(id, actorName); break
      case "adjust": {
        const unit = b.unit === "KG" ? "KG" : "PIECE"
        const delta = Number(b.delta)
        if (!Number.isFinite(delta) || delta === 0) return NextResponse.json({ error: "A non-zero delta is required for adjust" }, { status: 400 })
        res = await manualAdjust(id, { unit, delta, note: b.note, actorName })
        break
      }
      default: return NextResponse.json({ error: `Unknown action "${action}"` }, { status: 400 })
    }
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 409 })
    return NextResponse.json({ success: true, data: res })
  } catch (e) {
    console.error("[laundry-subscription-renewal] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
