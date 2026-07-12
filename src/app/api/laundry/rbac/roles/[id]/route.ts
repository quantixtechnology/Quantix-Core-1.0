// GET    /api/laundry/rbac/roles/[id]  — role + permission keys
// PUT    /api/laundry/rbac/roles/[id]  — edit name/description/active
// DELETE /api/laundry/rbac/roles/[id]  — delete (owner role protected)
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireLaundryPermission, rbacAudit } from "@/lib/laundry-rbac"

export const runtime = "nodejs"

async function scopedRole(platformBusinessId: string, id: string) {
  return prisma.laundryAccessRole.findFirst({ where: { id, businessId: platformBusinessId }, include: { permissions: true } })
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const businessId = new URL(request.url).searchParams.get("businessId")
  const guard = await requireLaundryPermission(request, businessId, "laundry.staff.view")
  if (!guard.ok) return guard.res
  const role = await scopedRole(guard.platformBusinessId, id)
  if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 })
  return NextResponse.json({ success: true, data: { ...role, permissions: role.permissions.filter((p) => p.effect === "ALLOW").map((p) => p.permKey) } })
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const b = await request.json().catch(() => ({}))
  const guard = await requireLaundryPermission(request, b.businessId, "laundry.staff.assign_role")
  if (!guard.ok) return guard.res
  const role = await scopedRole(guard.platformBusinessId, id)
  if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 })
  // Owner protection: the full-access owner role cannot be deactivated.
  if (role.isOwner && b.isActive === false) return NextResponse.json({ error: "The Business Owner role cannot be deactivated", code: "OWNER_PROTECTED" }, { status: 409 })
  const updated = await prisma.laundryAccessRole.update({ where: { id }, data: {
    ...(b.name !== undefined && { name: String(b.name).trim() }),
    ...(b.description !== undefined && { description: b.description || null }),
    ...(b.isActive !== undefined && !role.isOwner && { isActive: !!b.isActive }),
  } })
  await rbacAudit(guard.platformBusinessId, "ROLE_EDITED", { roleId: id, actorName: guard.ctx.userName, detail: { name: updated.name, isActive: updated.isActive } })
  return NextResponse.json({ success: true, data: updated })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const businessId = new URL(request.url).searchParams.get("businessId")
  const guard = await requireLaundryPermission(request, businessId, "laundry.staff.assign_role")
  if (!guard.ok) return guard.res
  const role = await scopedRole(guard.platformBusinessId, id)
  if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 })
  // Owner protection: the Business Owner role can never be deleted.
  if (role.isOwner) return NextResponse.json({ error: "The Business Owner role cannot be deleted", code: "OWNER_PROTECTED" }, { status: 409 })
  await prisma.laundryAccessRole.delete({ where: { id } }) // cascades permissions + assignments
  await rbacAudit(guard.platformBusinessId, "ROLE_DELETED", { roleId: id, actorName: guard.ctx.userName, detail: { name: role.name, code: role.code } })
  return NextResponse.json({ success: true })
}
