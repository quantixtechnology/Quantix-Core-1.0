// POST /api/laundry/seed-demo  { businessId }
// Seeds demo operational masters (Categories/Services/Garments/Pricing) for a
// workspace, only where a table is empty. Idempotent — safe to call repeatedly.
import { NextResponse } from "next/server"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { seedLaundryDemo } from "@/lib/laundry-seed"
import { requireLaundryMember } from "@/lib/laundry-rbac"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const { businessId } = await request.json()
    // Seeding writes into a tenant — membership required.
    const _guard = await requireLaundryMember(request, businessId)
    if (!_guard.ok) return _guard.res
    if (!businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ error: `No laundry workspace matches businessId "${businessId}"` }, { status: 404 })
    const result = await seedLaundryDemo(biz.id)
    return NextResponse.json({ success: true, data: result })
  } catch (e) {
    console.error("[laundry-seed-demo] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
