// Assign a reusable bag to an order+service during pickup. Only an AVAILABLE
// bag can be assigned. One bag = one service (a service cannot get two bags,
// a bag holds one service). Sets the bag COLLECTED and logs the assignment.
// No QR is generated — the physical bag's permanent QR is reused.
import { NextResponse } from "next/server"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { assignBagToOrder , BAG_PURPOSE } from "@/lib/laundry-bag-assign"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const b = await request.json().catch(() => ({}))
    const businessId = b.businessId as string | undefined
    const code = String(b.code || b.bagNumber || b.qrValue || "").trim()
    const orderId = String(b.orderId || "").trim()
    if (!businessId || !code || !orderId) return NextResponse.json({ success: false, error: "businessId, code and orderId are required" }, { status: 400 })
    const guard = await requireLaundryPermission(request, businessId, "laundry.orders.create")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ success: false, error: "Laundry business not found" }, { status: 404 })

    const r = await assignBagToOrder({ lbId: biz.id, code, orderId, serviceId: b.serviceId ? String(b.serviceId) : null, serviceName: b.serviceName , purpose: BAG_PURPOSE.PICKUP})
    if (!r.ok) return NextResponse.json({ success: false, error: r.error }, { status: r.status })
    return NextResponse.json({ success: true, data: r.bag }, { status: 201 })
  } catch (e) {
    console.error("[bags-assign] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
