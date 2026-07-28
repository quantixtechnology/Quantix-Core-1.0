import { NextResponse } from "next/server"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { getLaundryAuthContext } from "@/lib/laundry-auth"
import { resolveUserPermissions, ensureSystemRolesSeeded } from "@/lib/laundry-rbac"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const businessId = new URL(request.url).searchParams.get("businessId")
  if (!businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
  const biz = await resolveLaundryBusiness(businessId)
  if (!biz?.platformBusinessId) return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })
  const ctx = await getLaundryAuthContext(biz.id, request)
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  await ensureSystemRolesSeeded(biz.platformBusinessId)
  const r = await resolveUserPermissions(biz.platformBusinessId, ctx.userId, ctx.role)
  const levelsObj: Record<string, number> = {}
  for (const [k, v] of r.levels) levelsObj[k] = v
  return NextResponse.json({ success: true, data: { roleCode: r.roleCode, roleName: r.roleName, isOwner: r.isOwner, source: r.source, levels: levelsObj } })
}
