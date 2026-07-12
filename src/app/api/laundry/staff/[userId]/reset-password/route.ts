// POST /api/laundry/staff/[userId]/reset-password — the Business Owner resets an
// employee's password (tenant-scoped; guarded by Laundry RBAC, not Core RBAC).
// Sets mustChangePassword so the employee changes it on next login. Returns the
// temporary credentials for the owner to hand over.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireLaundryPermission, rbacAudit } from "@/lib/laundry-rbac"
import { hashPassword } from "@/lib/password-utils"

export const runtime = "nodejs"
const genPassword = () => `Laundry@${Math.random().toString(36).slice(2, 7).toUpperCase()}`

export async function POST(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params
  const b = await request.json().catch(() => ({}))
  const guard = await requireLaundryPermission(request, b.businessId, "laundry.staff.edit")
  if (!guard.ok) return guard.res
  const platformBusinessId = guard.platformBusinessId

  // The target must be an employee of THIS tenant.
  const bu = await prisma.businessUser.findFirst({ where: { userId, businessId: platformBusinessId }, select: { id: true } })
  if (!bu) return NextResponse.json({ error: "Employee not found" }, { status: 404 })
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const rawPassword = String(b.newPassword || "").trim() || genPassword()
  if (rawPassword.length < 6) return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 })
  const passwordHash = await hashPassword(rawPassword)
  await prisma.user.update({ where: { id: userId }, data: { passwordHash, authProvider: "PASSWORD", hasPassword: true, mustChangePassword: true } })
  await rbacAudit(platformBusinessId, "EMPLOYEE_PASSWORD_RESET", { targetUserId: userId, actorName: guard.ctx.userName })

  return NextResponse.json({ success: true, data: { email: user.email, tempPassword: rawPassword } })
}
