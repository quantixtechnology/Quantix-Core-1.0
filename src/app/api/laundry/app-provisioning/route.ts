// GET  /api/laundry/app-provisioning?businessId= — provisioning + HTTPS status for
//   BOTH tenant apps (customer + executive). Auto-heals: if a host isn't secured
//   yet and the server/DNS are ready, it kicks off provisioning in the background
//   so onboarding needs NO manual step.
// POST /api/laundry/app-provisioning — retry provisioning for both hosts (used
//   only when provisioning has failed).
import { NextResponse } from "next/server"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { getTenantAppStatus, provisionTenantApps } from "@/lib/laundry-app-provisioning"
import { prisma } from "@/lib/prisma"
import { builtApkUrl, type ApkDeploymentType } from "@/lib/mobile-apk-artifacts"

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
    // One background provision covers all three hosts. Heal when the customer host
    // is up and either the executive or the store host isn't secured yet.
    const execNeedsHeal = status.executive.sslStatus === "pending" || status.executive.sslStatus === "failed"
    const storeNeedsHeal = status.store.sslStatus === "pending" || status.store.sslStatus === "failed"
    if (status.customer.httpsReachable && (execNeedsHeal || storeNeedsHeal)) {
      void provisionTenantApps(guard.platformBusinessId).catch(() => {})
      if (execNeedsHeal) status.executive.sslStatus = "provisioning"
      if (storeNeedsHeal) status.store.sslStatus = "provisioning"
    }
    // ── Android builds ──────────────────────────────────────────────────────
    // Two sources, in this order:
    //
    //   1. An APK built for this tenant and sitting in public/apks. It exists
    //      on this server, so the link cannot 404.
    //   2. The apkUrl the mobile-provision pipeline recorded on the Deployment
    //      row (falling back to liveUrl) — used when nothing is built here.
    //
    // Read here rather than from a second endpoint because this route has
    // ALREADY resolved the platform business and proved the caller belongs to
    // it — a separate call would be a second place for that check to be got
    // wrong. The slug then scopes the filenames to that same business.
    //
    // A pipeline build that is not LIVE has no downloadable artifact, whatever
    // URL the row happens to carry: offering it would hand someone a 404. A
    // file on disk needs no such judgement — it is either there or it is not.
    const APK_TYPES: ApkDeploymentType[] = ["CUSTOMER_APP", "DELIVERY_APP", "ADMIN_APP"]
    const biz = await prisma.business.findUnique({
      where: { id: guard.platformBusinessId },
      select: { slug: true },
    })
    const deployments = await prisma.deployment.findMany({
      where: { businessId: guard.platformBusinessId, type: { in: ["CUSTOMER_APP", "DELIVERY_APP", "ADMIN_APP"] } },
      select: { type: true, status: true, liveUrl: true, hostingConfig: true },
    })
    const byType = new Map(deployments.map((d) => [d.type, d]))
    const apk: Record<string, { url: string | null; status: string }> = {}
    for (const type of APK_TYPES) {
      const local = builtApkUrl(biz?.slug, type)
      if (local) { apk[type] = { url: local, status: "BUILT" }; continue }

      const d = byType.get(type)
      if (!d) { apk[type] = { url: null, status: "NOT_BUILT" }; continue }
      let cfgApk: string | null = null
      try {
        const cfg = d.hostingConfig ? (JSON.parse(d.hostingConfig) as Record<string, unknown>) : {}
        cfgApk = typeof cfg.apkUrl === "string" ? cfg.apkUrl : null
      } catch { /* malformed config is no URL, never a crash */ }
      const url = cfgApk ?? d.liveUrl ?? null
      apk[type] = { url: d.status === "LIVE" && url ? url : null, status: d.status }
    }

    return NextResponse.json({ success: true, data: { ...status, apk } })
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
    return NextResponse.json({ success: true, customer: { ssl: r.customer.ssl, https: r.customer.httpsReachable }, executive: { ssl: r.executive.ssl, https: r.executive.httpsReachable }, store: { ssl: r.store.ssl, https: r.store.httpsReachable } })
  } catch (e) {
    console.error("[laundry-app-provisioning] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
