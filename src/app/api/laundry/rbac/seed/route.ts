import { NextResponse } from "next/server"
import { seedSystemRoles, reconcileSystemRoles, rbacAudit, Level, requireLaundryLevel } from "@/lib/laundry-rbac"
import { ROLE_ADMIN_SCREEN } from "@/lib/laundry-rbac-screens"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const b = await request.json().catch(() => ({}))
  const guard = await requireLaundryLevel(request, b.businessId, ROLE_ADMIN_SCREEN, Level.EDIT)
  if (!guard.ok) return guard.res
  const created = await seedSystemRoles(guard.platformBusinessId)
  if (created.length) await rbacAudit(guard.platformBusinessId, "ROLE_CREATED", { actorName: guard.ctx.userName, detail: { seeded: created } })

  // Roles that already existed are skipped by the seeder, so a tenant seeded
  // against an older catalog keeps its old definitions forever. Reconcile them
  // in the same explicit, audited action — additive only, custom roles
  // untouched.
  const repaired = await reconcileSystemRoles(guard.platformBusinessId)
  if (repaired.length) await rbacAudit(guard.platformBusinessId, "PERMISSIONS_CHANGED", { actorName: guard.ctx.userName, detail: { reconciled: repaired } })

  return NextResponse.json({ success: true, data: { seeded: created, repaired } })
}
