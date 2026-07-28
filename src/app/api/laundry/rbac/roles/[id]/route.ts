import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireLaundryPermission, rbacAudit, Level } from "@/lib/laundry-rbac"

export const runtime = "nodejs"

async function scopedRole(platformBusinessId: string, id: string) {
  return prisma.laundryAccessRole.findFirst({ where: { id, businessId: platformBusinessId }, include: { permissions: true } })
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const businessId = new URL(request.url).searchParams.get("businessId")
  const guard = await requireLaundryPermission(request, businessId, "laundry.staff", Level.VIEW)
  if (!guard.ok) return guard.res
  const role = await scopedRole(guard.platformBusinessId, id)
  if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 })
  const levels: Record<string, number> = {}
  for (const p of role.permissions.filter((p) => p.effect === "ALLOW")) levels[p.permKey] = p.level || 1
  return NextResponse.json({ success: true, data: { ...role, levels, permissions: undefined } })
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const b = await request.json().catch(() => ({}))
  const guard = await requireLaundryPermission(request, b.businessId, "laundry.staff", Level.EDIT)
  if (!guard.ok) return guard.res
  const role = await scopedRole(guard.platformBusinessId, id)
  if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 })
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
  const guard = await requireLaundryPermission(request, businessId, "laundry.staff", Level.EDIT)
  if (!guard.ok) return guard.res
  const role = await scopedRole(guard.platformBusinessId, id)
  if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 })
  if (role.isOwner) return NextResponse.json({ error: "The Business Owner role cannot be deleted", code: "OWNER_PROTECTED" }, { status: 409 })
  await prisma.laundryAccessRole.delete({ where: { id } })
  await rbacAudit(guard.platformBusinessId, "ROLE_DELETED", { roleId: id, actorName: guard.ctx.userName, detail: { name: role.name, code: role.code } })
  return NextResponse.json({ success: true })
}
