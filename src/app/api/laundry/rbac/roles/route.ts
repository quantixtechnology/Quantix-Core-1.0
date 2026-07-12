// GET  /api/laundry/rbac/roles?businessId=  — list roles (+ permission counts)
// POST /api/laundry/rbac/roles               — create a custom role
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireLaundryPermission, rbacAudit } from "@/lib/laundry-rbac"
import { isValidPermissionKey } from "@/lib/laundry-rbac-catalog"

export const runtime = "nodejs"
const slug = (s: string) => s.toUpperCase().trim().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "ROLE"

export async function GET(request: Request) {
  const businessId = new URL(request.url).searchParams.get("businessId")
  const guard = await requireLaundryPermission(request, businessId, "laundry.staff.view")
  if (!guard.ok) return guard.res
  const roles = await prisma.laundryAccessRole.findMany({
    where: { businessId: guard.platformBusinessId },
    orderBy: [{ isOwner: "desc" }, { isSystem: "desc" }, { name: "asc" }],
    include: { _count: { select: { permissions: true, assignments: true } } },
  })
  return NextResponse.json({ success: true, data: roles })
}

export async function POST(request: Request) {
  const b = await request.json().catch(() => ({}))
  const guard = await requireLaundryPermission(request, b.businessId, "laundry.staff.assign_role")
  if (!guard.ok) return guard.res
  if (!b.name?.trim()) return NextResponse.json({ error: "Role name is required" }, { status: 400 })
  const businessId = guard.platformBusinessId
  let code = b.code ? slug(b.code) : slug(b.name)
  let n = 1
  while (await prisma.laundryAccessRole.findFirst({ where: { businessId, code } })) code = `${slug(b.name)}_${++n}`

  const perms: string[] = (Array.isArray(b.permissions) ? [...new Set((b.permissions as unknown[]).map((x) => String(x)))] : []).filter(isValidPermissionKey)
  const role = await prisma.laundryAccessRole.create({ data: { businessId, code, name: b.name.trim(), description: b.description || null, isSystem: false, isOwner: false, isActive: b.isActive !== false } })
  if (perms.length) await prisma.laundryAccessPermission.createMany({ data: perms.map((permKey) => ({ roleId: role.id, permKey, effect: "ALLOW" })) })
  await rbacAudit(businessId, "ROLE_CREATED", { roleId: role.id, actorName: guard.ctx.userName, detail: { name: role.name, permissions: perms.length } })
  return NextResponse.json({ success: true, data: role }, { status: 201 })
}
