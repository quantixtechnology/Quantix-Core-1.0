import { NextResponse } from "next/server"
import { requireLaundryLevel, rbacAudit, Level } from "@/lib/laundry-rbac"
import { syncLaundryPermissions } from "@/lib/permission-sync"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const { businessId } = await request.json().catch(() => ({}))
  const guard = await requireLaundryLevel(request, businessId, "laundry.rbac", Level.EDIT)
  if (!guard.ok) return guard.res

  const result = await syncLaundryPermissions(guard.platformBusinessId)
  await rbacAudit(guard.platformBusinessId, "RBAC_SYNC", {
    actorName: guard.ctx.userName,
    detail: {
      totalScreens: result.totalScreens,
      totalNavItems: result.totalNavItems,
      orphanPermissions: result.orphanPermissions,
      orphanNavKeys: result.orphanNavKeys,
      removedPermissions: result.removedPermissions,
      removedNavItems: result.removedNavItems,
    },
  })
  return NextResponse.json({ success: true, data: result })
}
