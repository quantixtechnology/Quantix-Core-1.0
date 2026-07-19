// GET  /api/laundry/app-provisioning?businessId= — provisioning + HTTPS status for
//   BOTH tenant apps (customer + executive). Auto-heals: if a host isn't secured
//   yet and the server/DNS are ready, it kicks off provisioning in the background
//   so onboarding needs NO manual step.
// POST /api/laundry/app-provisioning — retry provisioning for both hosts (used
//   only when provisioning has failed).
import { NextResponse } from "next/server"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { getTenantAppStatus, provisionTenantApps } from "@/lib/laundry-app-provisioning"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const businessId = new URL(request.url).searchParams.get("businessId")
    const guard = await requireLaundryPermission(request, businessId, "laundry.staff.view")
    if (!guard.ok) return guard.res
    const status = await getTenantAppStatus(guard.platformBusinessId)
    if (!status) return NextResponse.json({ success: true, data: null })

    // Auto-provision (no manual step): if the executive host isn't secured yet and
    // the customer host is already reachable (server + DNS are up), kick off
    // provisioning in the background. Setting 'provisioning' prevents re-firing.
    if (status.customer.httpsReachable && (status.executive.sslStatus === "pending" || status.executive.sslStatus === "failed")) {
      void provisionTenantApps(guard.platformBusinessId).catch(() => {})
      status.executive.sslStatus = "provisioning"
    }
    return NextResponse.json({ success: true, data: status })
  } catch (e) {
    console.error("[laundry-app-provisioning] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const b = await request.json().catch(() => ({}))
    const guard = await requireLaundryPermission(request, b.businessId, "laundry.settings.edit")
    if (!guard.ok) return guard.res
    const r = await provisionTenantApps(guard.platformBusinessId)
    if (!r.ok) return NextResponse.json({ success: false, error: r.error }, { status: 400 })
    return NextResponse.json({ success: true, customer: { ssl: r.customer.ssl, https: r.customer.httpsReachable }, executive: { ssl: r.executive.ssl, https: r.executive.httpsReachable } })
  } catch (e) {
    console.error("[laundry-app-provisioning] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
