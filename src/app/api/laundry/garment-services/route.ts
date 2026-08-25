// GET /api/laundry/garment-services?businessId= — garmentId → the services that
// garment is actually priced for, so New Order can offer only those.
//
// Member-guarded, not pricing-guarded: counter staff take orders and need to
// know what is orderable, but hold no pricing permission. Same reasoning as the
// subscription-coverage endpoint.
import { NextResponse } from "next/server"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryMember } from "@/lib/laundry-rbac"
import { garmentServiceAvailability } from "@/lib/laundry-garment-services"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const businessId = new URL(request.url).searchParams.get("businessId")
  if (!businessId) return NextResponse.json({ error: "businessId required" }, { status: 400 })
  const guard = await requireLaundryMember(request, businessId)
  if (!guard.ok) return guard.res
  const biz = await resolveLaundryBusiness(businessId)
  if (!biz) return NextResponse.json({ success: true, data: {} })
  const data = await garmentServiceAvailability(biz.id).catch(() => ({}))
  return NextResponse.json({ success: true, data })
}
