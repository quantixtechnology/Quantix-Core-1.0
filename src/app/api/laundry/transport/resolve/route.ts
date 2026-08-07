// GET /api/laundry/transport/resolve?businessId=&code=&direction=
// Scan / manual-entry lookup for every transport screen. The configured
// Transport Setup mode decides which identifiers are accepted — a bag QR in
// BAG mode, a packet QR in PACKET mode, either in BOTH — so no screen has to
// know which one this business uses.
//
// direction: STORE_TO_PROCESSING (default) | PROCESSING_TO_STORE
import { NextResponse } from "next/server"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { getTransportMode, resolveOrderByTransportCode } from "@/lib/laundry-transport-server"
import type { TransportDirection } from "@/lib/laundry-transport"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const sp = new URL(request.url).searchParams
    const businessId = sp.get("businessId")
    if (!businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
    const guard = await requireLaundryPermission(request, businessId, "laundry.orders.view")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })

    const code = (sp.get("code") || "").trim()
    if (!code) return NextResponse.json({ error: "Missing code" }, { status: 400 })
    const direction: TransportDirection = sp.get("direction") === "PROCESSING_TO_STORE" ? "PROCESSING_TO_STORE" : "STORE_TO_PROCESSING"

    const mode = await getTransportMode(biz.id, direction)
    const hit = await resolveOrderByTransportCode(biz.id, code, mode)
    if (!hit) return NextResponse.json({ success: false, mode, error: `No order matches "${code}"` }, { status: 404 })

    return NextResponse.json({ success: true, mode, data: hit })
  } catch (e) {
    console.error("[laundry-transport-resolve] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
