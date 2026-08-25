// GET /api/laundry/subscription-coverage?businessId= — which garment × service
// pairs a subscription covers.
//
// Eligibility is decided per PAIR on the pricing rule, so a screen cannot work
// it out from a garment flag and a service flag any more. This returns the
// engine's OWN answer (subscriptionCoverageRules), which is what keeps Store
// Audit from promising cover the engine will not grant.
//
// Member-guarded rather than pricing-guarded: counter and audit staff need to
// read eligibility while intaking garments, and they hold no pricing permission.
import { NextResponse } from "next/server"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryMember } from "@/lib/laundry-rbac"
import { subscriptionCoverageRules } from "@/lib/laundry-subscription-server"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const businessId = new URL(request.url).searchParams.get("businessId")
  if (!businessId) return NextResponse.json({ error: "businessId required" }, { status: 400 })
  const guard = await requireLaundryMember(request, businessId)
  if (!guard.ok) return guard.res
  const biz = await resolveLaundryBusiness(businessId)
  if (!biz) return NextResponse.json({ success: true, data: [] })
  const pairs = await subscriptionCoverageRules(biz.id).catch(() => [])
  return NextResponse.json({ success: true, data: pairs })
}
