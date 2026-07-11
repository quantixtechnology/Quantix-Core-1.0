// POST /api/laundry/customers/merge — safely merge a duplicate customer into a
// primary (Part 10). Repoints orders, subscriptions, payments, addresses, notes,
// documents and timeline; recomputes stats; retires the duplicate. Nothing is
// deleted — history is preserved on the primary.
//
// Body: { businessId, primaryId, duplicateId, actorName? }
import { NextResponse } from "next/server"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { mergeCustomers } from "@/lib/laundry-customer"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const b = await request.json()
    if (!b.businessId || !b.primaryId || !b.duplicateId) return NextResponse.json({ error: "businessId, primaryId and duplicateId are required" }, { status: 400 })
    const biz = await resolveLaundryBusiness(b.businessId)
    if (!biz?.platformBusinessId) return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })
    const res = await mergeCustomers(biz.platformBusinessId, b.primaryId, b.duplicateId, b.actorName || null)
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 409 })
    return NextResponse.json({ success: true, data: res })
  } catch (e) {
    console.error("[laundry-customer-merge] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
