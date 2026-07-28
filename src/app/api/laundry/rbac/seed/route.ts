import { NextResponse } from "next/server"
import { requireLaundryLevel, seedSystemRoles, rbacAudit, Level } from "@/lib/laundry-rbac"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const b = await request.json().catch(() => ({}))
  const guard = await requireLaundryLevel(request, b.businessId, "laundry.staff", Level.EDIT)
  if (!guard.ok) return guard.res
  const created = await seedSystemRoles(guard.platformBusinessId)
  if (created.length) await rbacAudit(guard.platformBusinessId, "ROLE_CREATED", { actorName: guard.ctx.userName, detail: { seeded: created } })
  return NextResponse.json({ success: true, data: { seeded: created } })
}
