// POST /api/laundry/rbac/seed — create the 10 default system roles for this
// tenant (idempotent). Owner / manage-roles only.
import { NextResponse } from "next/server"
import { requireLaundryPermission, seedSystemRoles, rbacAudit } from "@/lib/laundry-rbac"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const b = await request.json().catch(() => ({}))
  const guard = await requireLaundryPermission(b.businessId, "laundry.staff.assign_role")
  if (!guard.ok) return guard.res
  const created = await seedSystemRoles(guard.platformBusinessId)
  if (created.length) await rbacAudit(guard.platformBusinessId, "ROLE_CREATED", { actorName: guard.ctx.userName, detail: { seeded: created } })
  return NextResponse.json({ success: true, data: { seeded: created } })
}
