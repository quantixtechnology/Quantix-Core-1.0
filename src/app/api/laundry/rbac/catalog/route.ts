// GET /api/laundry/rbac/catalog[?businessId=] — the modules and screens that
// Roles & Permissions may grant.
//
// With a businessId the catalog is filtered by the tenant's licence, so a
// module they have not bought offers no permissions to hand out. Without one
// the full registry is returned, which is what the platform-level tooling and
// the seeder need.
import { NextResponse } from "next/server"
import { SCREEN_MODULES, LEVEL_LABELS } from "@/lib/laundry-rbac-registry"
import { resolveLicenceForBusiness } from "@/lib/laundry-licensing-server"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const businessId = new URL(request.url).searchParams.get("businessId")
  if (!businessId) {
    return NextResponse.json({ success: true, data: { modules: SCREEN_MODULES, levels: LEVEL_LABELS } })
  }

  const resolved = await resolveLicenceForBusiness(businessId)
  // An unknown business gets the unfiltered catalog rather than an error: this
  // endpoint is also read by tooling that is not tenant-scoped, and failing
  // here would break Roles & Permissions instead of merely showing more.
  if (!resolved) {
    return NextResponse.json({ success: true, data: { modules: SCREEN_MODULES, levels: LEVEL_LABELS } })
  }

  const { licence } = resolved
  const modules = SCREEN_MODULES
    .map((m) => ({ ...m, screens: m.screens.filter((s) => licence.isScreenEnabled(`${m.key}.${s.key}`)) }))
    .filter((m) => m.screens.length > 0)

  return NextResponse.json({ success: true, data: { modules, levels: LEVEL_LABELS } })
}
