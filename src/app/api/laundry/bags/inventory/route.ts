// GET /api/laundry/bags/inventory?businessId=… — the reconciling bag census.
//
// Every registered bag lands in EXACTLY ONE bucket, so the buckets always sum
// to the total (§14). Bags with customers are counted and visible but are NOT
// available stock — that separation is the whole point of this module.
import { NextResponse } from "next/server"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { getBagInventory } from "@/lib/laundry-bag-lifecycle"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get("businessId")
    if (!businessId) return NextResponse.json({ success: false, error: "Missing businessId" }, { status: 400 })
    const guard = await requireLaundryPermission(request, businessId, "laundry.bags.view")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ success: false, error: "Laundry business not found" }, { status: 404 })

    return NextResponse.json({ success: true, data: await getBagInventory(biz.id) })
  } catch (e) {
    console.error("[bags-inventory] GET", e)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
