// POST /api/laundry/bags/identify { businessId?, code, customerId? }
//
// Reads a scanned bag and reports WHO had it last — without changing anything.
// This is the screen the executive sees when a customer hands back an old bag:
// it names the previous customer and order so the decision to reuse it is made
// by a person, never silently by the system (§9, Rule 10).
//
// Dual auth: Delivery Executive PWA (bearer session) OR desktop admin.
import { NextResponse } from "next/server"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { resolveExecutive } from "@/lib/laundry-executive-auth"
import { identifyReturnedBag } from "@/lib/laundry-bag-lifecycle"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const b = await request.json().catch(() => ({}))
    const code = String(b.code || b.bagNumber || b.qrValue || "").trim()
    if (!code) return NextResponse.json({ success: false, error: "A bag code is required" }, { status: 400 })

    let lbId: string | null = null
    const session = await resolveExecutive(request)
    if (session) {
      lbId = session.businessId
    } else {
      if (!b.businessId) return NextResponse.json({ success: false, error: "businessId is required" }, { status: 400 })
      const guard = await requireLaundryPermission(request, b.businessId, "laundry.bags.view")
      if (!guard.ok) return guard.res
      const biz = await resolveLaundryBusiness(b.businessId)
      if (!biz) return NextResponse.json({ success: false, error: "Laundry business not found" }, { status: 404 })
      lbId = biz.id
    }

    const r = await identifyReturnedBag({ lbId, code, customerId: b.customerId ? String(b.customerId) : null })
    if (!r.ok) return NextResponse.json({ success: false, error: r.error, code: r.code }, { status: r.status })
    return NextResponse.json({ success: true, data: r.bag })
  } catch (e) {
    console.error("[bags-identify] POST", e)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
