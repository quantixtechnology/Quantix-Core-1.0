// GET /api/laundry/rbac/roles/[id]/permissions  — the role's ALLOW keys
// PUT /api/laundry/rbac/roles/[id]/permissions  — replace the permission matrix
//   Body: { businessId, permissions: string[] }  (validated against the catalog)
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireLaundryPermission, rbacAudit } from "@/lib/laundry-rbac"
import { isValidPermissionKey } from "@/lib/laundry-rbac-catalog"

export const runtime = "nodejs"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const businessId = new URL(request.url).searchParams.get("businessId")
  const guard = await requireLaundryPermission(businessId, "laundry.staff.view")
  if (!guard.ok) return guard.res
  const role = await prisma.laundryAccessRole.findFirst({ where: { id, businessId: guard.platformBusinessId }, include: { permissions: true } })
  if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 })
  return NextResponse.json({ success: true, data: { isOwner: role.isOwner, permissions: role.permissions.filter((p) => p.effect === "ALLOW").map((p) => p.permKey) } })
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const b = await request.json().catch(() => ({}))
  const guard = await requireLaundryPermission(b.businessId, "laundry.staff.assign_role")
  if (!guard.ok) return guard.res
  const role = await prisma.laundryAccessRole.findFirst({ where: { id, businessId: guard.platformBusinessId }, select: { id: true, isOwner: true, name: true } })
  if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 })
  // Owner protection: the owner role is always full access — its matrix is
  // implicit and cannot be edited (cannot lose full access).
  if (role.isOwner) return NextResponse.json({ error: "The Business Owner role always has full access and cannot be edited", code: "OWNER_PROTECTED" }, { status: 409 })

  const perms: string[] = (Array.isArray(b.permissions) ? [...new Set((b.permissions as unknown[]).map((x) => String(x)))] : []).filter(isValidPermissionKey)
  await prisma.$transaction([
    prisma.laundryAccessPermission.deleteMany({ where: { roleId: id } }),
    ...(perms.length ? [prisma.laundryAccessPermission.createMany({ data: perms.map((permKey) => ({ roleId: id, permKey, effect: "ALLOW" })) })] : []),
  ])
  await rbacAudit(guard.platformBusinessId, "PERMISSIONS_CHANGED", { roleId: id, actorName: guard.ctx.userName, detail: { role: role.name, count: perms.length } })
  return NextResponse.json({ success: true, data: { permissions: perms } })
}
