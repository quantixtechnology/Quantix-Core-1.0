// GET /api/laundry/bags/history — Release history for reusable bags.
// Query: businessId (required), bagId (optional)
import { NextResponse } from "next/server"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { getReleaseHistory } from "@/lib/laundry-bag-assign"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get("businessId")
    const bagId = searchParams.get("bagId") || undefined
    if (!businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })

    const guard = await requireLaundryPermission(request, businessId, "laundry.bags.view")
    if (!guard.ok) return guard.res

    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ success: true, data: [] })

    const rows = await getReleaseHistory(biz.id, { bagId })
    return NextResponse.json({ success: true, data: rows })
  } catch (e) {
    console.error("[bags-history] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
