// GET /api/laundry/subscriptions/[id]/ledger
// The append-only allowance ledger + current KG/Piece balances (Part 8).
import { NextResponse } from "next/server"
import { subscriptionLedger } from "@/lib/laundry-subscription-server"

export const runtime = "nodejs"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { sub, entries } = await subscriptionLedger(id)
    if (!sub) return NextResponse.json({ error: "Subscription not found" }, { status: 404 })
    return NextResponse.json({ success: true, data: { subscription: sub, entries } })
  } catch (e) {
    console.error("[laundry-subscription-ledger] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
