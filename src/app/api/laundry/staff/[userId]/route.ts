// PATCH /api/laundry/staff/[userId] — edit an employee: name/phone, active
// status, Laundry role and store. Role/store changes take effect immediately
// (next request re-resolves permissions). The Business Owner is protected —
// an owner-role employee can never be deactivated or demoted here.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireLaundryPermission, rbacAudit } from "@/lib/laundry-rbac"

export const runtime = "nodejs"

export async function PATCH(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params
  const b = await request.json().catch(() => ({}))
  // Role changes require assign_role; everything else requires edit. Owner has both.
  const key = b.roleId !== undefined ? "laundry.staff.assign_role" : "laundry.staff.edit"
  const guard = await requireLaundryPermission(request, b.businessId, key)
  if (!guard.ok) return guard.res
  const platformBusinessId = guard.platformBusinessId

  const bu = await prisma.businessUser.findFirst({ where: { userId, businessId: platformBusinessId }, select: { id: true, role: true } })
  if (!bu) return NextResponse.json({ error: "Employee not found" }, { status: 404 })

  const currentAssignment = await prisma.laundryAccessAssignment.findFirst({
    where: { businessId: platformBusinessId, userId }, include: { role: { select: { isOwner: true } } },
  })
  const isOwnerEmployee = bu.role === "LAUNDRY_OWNER" || !!currentAssignment?.role.isOwner

  // The Business Owner never loses access.
  if (isOwnerEmployee && (b.active === false || (b.roleId !== undefined && b.roleId !== currentAssignment?.roleId))) {
    return NextResponse.json({ error: "The Business Owner cannot be deactivated or have their role changed." }, { status: 400 })
  }

  // User fields.
  const userData: Record<string, unknown> = {}
  if (typeof b.name === "string" && b.name.trim()) userData.name = b.name.trim()
  if ("phone" in b) userData.phone = b.phone ? String(b.phone).trim() : null
  if (Object.keys(userData).length) await prisma.user.update({ where: { id: userId }, data: userData })

  // Active status (BusinessUser scope for this tenant).
  if (typeof b.active === "boolean") {
    await prisma.businessUser.update({ where: { id: bu.id }, data: { isActive: b.active } })
    await rbacAudit(platformBusinessId, b.active ? "EMPLOYEE_ACTIVATED" : "EMPLOYEE_DEACTIVATED", { targetUserId: userId, actorName: guard.ctx.userName })
  }

  // Role / store — immediate effect via the Laundry RBAC assignment.
  if (b.roleId !== undefined || b.storeId !== undefined) {
    const roleId = b.roleId ?? currentAssignment?.roleId
    if (!roleId) return NextResponse.json({ error: "A role is required" }, { status: 400 })
    const role = await prisma.laundryAccessRole.findFirst({ where: { id: roleId, businessId: platformBusinessId }, select: { id: true, name: true, isOwner: true } })
    if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 })
    const storeId = b.storeId !== undefined ? (b.storeId || null) : (currentAssignment?.storeId ?? null)
    await prisma.laundryAccessAssignment.upsert({
      where: { businessId_userId: { businessId: platformBusinessId, userId } },
      create: { businessId: platformBusinessId, userId, roleId: role.id, storeId, active: true, assignedBy: guard.ctx.userName },
      update: { roleId: role.id, storeId, active: true },
    })
    // Keep the legacy BusinessUser role coherent with owner status.
    if (role.isOwner && bu.role !== "LAUNDRY_OWNER") await prisma.businessUser.update({ where: { id: bu.id }, data: { role: "LAUNDRY_OWNER" } })
    if (b.roleId !== undefined) await rbacAudit(platformBusinessId, "ROLE_ASSIGNED", { roleId: role.id, targetUserId: userId, actorName: guard.ctx.userName, detail: { role: role.name } })
  }

  return NextResponse.json({ success: true })
}
