import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireLaundryLevel, rbacAudit, ensureSystemRolesSeeded } from "@/lib/laundry-rbac"
import { isValidScreenKey, Level } from "@/lib/laundry-rbac-registry"

export const runtime = "nodejs"
const slug = (s: string) => s.toUpperCase().trim().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "ROLE"

export async function GET(request: Request) {
  const businessId = new URL(request.url).searchParams.get("businessId")
  const guard = await requireLaundryLevel(request, businessId, "laundry.staff", Level.VIEW)
  if (!guard.ok) return guard.res
  await ensureSystemRolesSeeded(guard.platformBusinessId)
  const roles = await prisma.laundryAccessRole.findMany({
    where: { businessId: guard.platformBusinessId },
    orderBy: [{ isOwner: "desc" }, { isSystem: "desc" }, { name: "asc" }],
    include: { _count: { select: { permissions: true, assignments: true } } },
  })
  return NextResponse.json({ success: true, data: roles })
}

export async function POST(request: Request) {
  const b = await request.json().catch(() => ({}))
  const guard = await requireLaundryLevel(request, b.businessId, "laundry.staff", Level.EDIT)
  if (!guard.ok) return guard.res
  if (!b.name?.trim()) return NextResponse.json({ error: "Role name is required" }, { status: 400 })
  const businessId = guard.platformBusinessId
  let code = b.code ? slug(b.code) : slug(b.name)
  let n = 1
  while (await prisma.laundryAccessRole.findFirst({ where: { businessId, code } })) code = `${slug(b.name)}_${++n}`

  const screens: Record<string, number> = (b.screens && typeof b.screens === "object") ? b.screens : {}
  const validPairs = Object.entries(screens).filter(([k, v]) => isValidScreenKey(k) && v >= Level.VIEW && v <= Level.EDIT)

  const role = await prisma.laundryAccessRole.create({ data: { businessId, code, name: b.name.trim(), description: b.description || null, isSystem: false, isOwner: false, isActive: b.isActive !== false } })
  if (validPairs.length) await prisma.laundryAccessPermission.createMany({ data: validPairs.map(([permKey, level]) => ({ roleId: role.id, permKey, level, effect: "ALLOW" })) })
  await rbacAudit(businessId, "ROLE_CREATED", { roleId: role.id, actorName: guard.ctx.userName, detail: { name: role.name, screens: validPairs.length } })
  return NextResponse.json({ success: true, data: role }, { status: 201 })
}
