// POST /api/laundry/rbac/roles/[id]/clone — clone a role (name + permissions)
// into a new custom role.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireLaundryPermission, rbacAudit } from "@/lib/laundry-rbac"

export const runtime = "nodejs"
const slug = (s: string) => s.toUpperCase().trim().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "ROLE"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const b = await request.json().catch(() => ({}))
  const guard = await requireLaundryPermission(b.businessId, "laundry.staff.assign_role")
  if (!guard.ok) return guard.res
  const businessId = guard.platformBusinessId
  const src = await prisma.laundryAccessRole.findFirst({ where: { id, businessId }, include: { permissions: true } })
  if (!src) return NextResponse.json({ error: "Role not found" }, { status: 404 })

  const name = (b.name?.trim()) || `${src.name} Copy`
  let code = slug(name); let n = 1
  while (await prisma.laundryAccessRole.findFirst({ where: { businessId, code } })) code = `${slug(name)}_${++n}`
  const role = await prisma.laundryAccessRole.create({ data: { businessId, code, name, description: src.description, isSystem: false, isOwner: false, isActive: true } })
  // Clone the source's permission rows (an owner role has none — the clone is a
  // normal role, never a second owner).
  if (src.permissions.length) await prisma.laundryAccessPermission.createMany({ data: src.permissions.map((p) => ({ roleId: role.id, permKey: p.permKey, effect: p.effect })) })
  await rbacAudit(businessId, "ROLE_CLONED", { roleId: role.id, actorName: guard.ctx.userName, detail: { from: src.code, name } })
  return NextResponse.json({ success: true, data: role }, { status: 201 })
}
