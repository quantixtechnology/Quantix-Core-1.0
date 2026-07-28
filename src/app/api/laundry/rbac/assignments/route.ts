import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireLaundryPermission, rbacAudit, Level } from "@/lib/laundry-rbac"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const businessId = new URL(request.url).searchParams.get("businessId")
  const guard = await requireLaundryPermission(request, businessId, "laundry.staff", Level.VIEW)
  if (!guard.ok) return guard.res
  const rows = await prisma.laundryAccessAssignment.findMany({ where: { businessId: guard.platformBusinessId }, include: { role: { select: { code: true, name: true } } }, orderBy: { createdAt: "desc" } })
  return NextResponse.json({ success: true, data: rows })
}

export async function POST(request: Request) {
  const b = await request.json().catch(() => ({}))
  const guard = await requireLaundryPermission(request, b.businessId, "laundry.staff", Level.EDIT)
  if (!guard.ok) return guard.res
  if (!b.userId || !b.roleId) return NextResponse.json({ error: "userId and roleId are required" }, { status: 400 })
  const businessId = guard.platformBusinessId
  const role = await prisma.laundryAccessRole.findFirst({ where: { id: b.roleId, businessId }, select: { id: true, name: true } })
  if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 })
  const assignment = await prisma.laundryAccessAssignment.upsert({
    where: { businessId_userId: { businessId, userId: b.userId } },
    create: { businessId, userId: b.userId, roleId: b.roleId, active: true, assignedBy: guard.ctx.userName },
    update: { roleId: b.roleId, active: true, assignedBy: guard.ctx.userName },
  })
  await rbacAudit(businessId, "ROLE_ASSIGNED", { roleId: b.roleId, targetUserId: b.userId, actorName: guard.ctx.userName, detail: { role: role.name } })
  return NextResponse.json({ success: true, data: assignment }, { status: 201 })
}

export async function DELETE(request: Request) {
  const sp = new URL(request.url).searchParams
  const guard = await requireLaundryPermission(request, sp.get("businessId"), "laundry.staff", Level.EDIT)
  if (!guard.ok) return guard.res
  const userId = sp.get("userId")
  if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 })
  await prisma.laundryAccessAssignment.deleteMany({ where: { businessId: guard.platformBusinessId, userId } })
  await rbacAudit(guard.platformBusinessId, "ROLE_REMOVED", { targetUserId: userId, actorName: guard.ctx.userName })
  return NextResponse.json({ success: true })
}
