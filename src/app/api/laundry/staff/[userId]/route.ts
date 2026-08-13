// PATCH  /api/laundry/staff/[userId] — edit an employee: name/phone, active
// status, Laundry role and store. Role/store changes take effect immediately
// (next request re-resolves permissions). The Business Owner is protected —
// an owner-role employee can never be deactivated or demoted here.
//
// DELETE /api/laundry/staff/[userId]?businessId= — Quantix Super Admin only.
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { withMiddleware } from "@/lib/middleware"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission, rbacAudit, isBusinessOwnerRole } from "@/lib/laundry-rbac"
import { staffDeletionRefusal } from "@/lib/staff-deletion"

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
  // Same owner relationship the permission resolver uses. Checking only
  // LAUNDRY_OWNER here left a Super-Admin-provisioned owner (CLIENT_OWNER)
  // demotable to an employee role — the one thing this guard exists to prevent.
  const isOwnerEmployee = isBusinessOwnerRole(bu.role) || !!currentAssignment?.role.isOwner

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
    // Keep the BusinessUser role coherent with owner status. An existing owner
    // (either marker) is left as-is — rewriting CLIENT_OWNER would churn the
    // relationship the platform side reads.
    if (role.isOwner && !isBusinessOwnerRole(bu.role)) await prisma.businessUser.update({ where: { id: bu.id }, data: { role: "LAUNDRY_OWNER" } })
    if (b.roleId !== undefined) await rbacAudit(platformBusinessId, "ROLE_ASSIGNED", { roleId: role.id, targetUserId: userId, actorName: guard.ctx.userName, detail: { role: role.name } })
  }

  return NextResponse.json({ success: true })
}

/**
 * DELETE /api/laundry/staff/[userId]?businessId=  — Quantix Super Admin only.
 *
 * Removes a staff member's ACCESS. It does not remove their work.
 *
 * Nothing operational is deleted, and nothing can be: no laundry model carries
 * a foreign key to User. Orders, garments, item events, audits and payments
 * record the actor as a plain string, so they are untouched by design rather
 * than by care. This follows the platform's existing deletion convention
 * (/api/core/users/[userId]/delete): deactivate, never destroy.
 *
 * What actually happens:
 *   - the BusinessUser membership for THIS business is removed → they are no
 *     longer staff here and disappear from the list
 *   - their Laundry RBAC assignment is deactivated → the role grant is gone
 *   - every refresh token is deleted → live sessions die immediately
 *   - the User is deactivated ONLY if this was their last membership, so
 *     removing someone from one business never locks them out of another
 *
 * Guarded by requiredRoles: ['QUANTIX_SUPER_ADMIN'] — deliberately NOT a
 * laundry screen permission. This is a platform-administrator action, so no
 * business role (owner included) can reach it.
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params
  return withMiddleware({ requireAuth: true, requiredRoles: ["QUANTIX_SUPER_ADMIN"] })(async (req) => {
    const businessIdInput = new URL(req.url).searchParams.get("businessId")
    if (!businessIdInput) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })

    const biz = await resolveLaundryBusiness(businessIdInput)
    if (!biz?.platformBusinessId) return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })
    const platformBusinessId = biz.platformBusinessId

    // Tenant scoping: the target must be a member of THIS business. A user id
    // from another business simply is not found here, so a manipulated id
    // cannot reach across tenants.
    const bu = await prisma.businessUser.findFirst({
      where: { userId, businessId: platformBusinessId },
      select: { id: true, role: true, user: { select: { id: true, name: true, email: true, platformRole: true } } },
    })
    if (!bu) return NextResponse.json({ error: "Employee not found in this business" }, { status: 404 })

    const assignment = await prisma.laundryAccessAssignment.findFirst({
      where: { businessId: platformBusinessId, userId },
      include: { role: { select: { isOwner: true } } },
    })

    const refusal = staffDeletionRefusal(
      { userId, platformRole: bu.user.platformRole, businessRole: bu.role, hasOwnerAssignment: !!assignment?.role.isOwner },
      req.user!.id,
      isBusinessOwnerRole,
    )
    if (refusal) return NextResponse.json({ error: refusal }, { status: 403 })

    // Other businesses this person still belongs to.
    const otherMemberships = await prisma.businessUser.count({
      where: { userId, businessId: { not: platformBusinessId } },
    })

    await prisma.$transaction(async (tx) => {
      await tx.businessUser.delete({ where: { id: bu.id } })
      if (assignment) await tx.laundryAccessAssignment.update({ where: { id: assignment.id }, data: { active: false } })
      // Kill live sessions. Their token is how they authenticate, so this is
      // what makes the removal take effect immediately rather than at expiry.
      await tx.refreshToken.deleteMany({ where: { userId } })
      // Only when they have nowhere else to be.
      if (otherMemberships === 0) await tx.user.update({ where: { id: userId }, data: { isActive: false } })
    })

    await rbacAudit(platformBusinessId, "EMPLOYEE_DELETED", {
      targetUserId: userId,
      actorName: req.user?.email ?? "Super Admin",
      detail: { name: bu.user.name, email: bu.user.email, userDeactivated: otherMemberships === 0 },
    }).catch(() => null)

    return NextResponse.json({ success: true, data: { userId, name: bu.user.name } })
  })(request)
}
