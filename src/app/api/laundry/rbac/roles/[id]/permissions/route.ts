import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireLaundryAnyLevel, rbacAudit, Level, requireLaundryLevel } from "@/lib/laundry-rbac"
import { ROLE_READ_SCREENS, ROLE_ADMIN_SCREEN } from "@/lib/laundry-rbac-screens"
import { isValidScreenKey } from "@/lib/laundry-rbac-registry"

export const runtime = "nodejs"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const businessId = new URL(request.url).searchParams.get("businessId")
  const guard = await requireLaundryAnyLevel(request, businessId, ROLE_READ_SCREENS, Level.VIEW)
  if (!guard.ok) return guard.res
  const role = await prisma.laundryAccessRole.findFirst({ where: { id, businessId: guard.platformBusinessId }, include: { permissions: true } })
  if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 })
  const levels: Record<string, number> = {}
  for (const p of role.permissions.filter((p) => p.effect === "ALLOW")) levels[p.permKey] = p.level || 1
  return NextResponse.json({ success: true, data: { isOwner: role.isOwner, levels } })
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const b = await request.json().catch(() => ({}))
  const guard = await requireLaundryLevel(request, b.businessId, ROLE_ADMIN_SCREEN, Level.EDIT)
  if (!guard.ok) return guard.res
  const role = await prisma.laundryAccessRole.findFirst({ where: { id, businessId: guard.platformBusinessId }, select: { id: true, isOwner: true, name: true } })
  if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 })
  if (role.isOwner) return NextResponse.json({ error: "The Business Owner role always has full access and cannot be edited", code: "OWNER_PROTECTED" }, { status: 409 })

  const screens: Record<string, number> = (b.screens && typeof b.screens === "object") ? b.screens : {}
  const validPairs = Object.entries(screens).filter(([k, v]) => isValidScreenKey(k) && v >= Level.VIEW && v <= Level.EDIT)

  await prisma.$transaction([
    prisma.laundryAccessPermission.deleteMany({ where: { roleId: id } }),
    ...(validPairs.length ? [prisma.laundryAccessPermission.createMany({ data: validPairs.map(([permKey, level]) => ({ roleId: id, permKey, level, effect: "ALLOW" })) })] : []),
  ])
  await rbacAudit(guard.platformBusinessId, "PERMISSIONS_CHANGED", { roleId: id, actorName: guard.ctx.userName, detail: { role: role.name, count: validPairs.length } })
  return NextResponse.json({ success: true, data: { screens: Object.fromEntries(validPairs) } })
}
