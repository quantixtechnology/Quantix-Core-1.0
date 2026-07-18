// GET /api/laundry/executives?businessId= — active laundry staff assignable as
// Pickup / Delivery executives. Executives are just laundry staff (RBAC), NOT a
// separate model — no parallel employee system. `isExecutive` flags staff whose
// role reads as a pickup/delivery role so the scheduler can surface them first.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireLaundryPermission } from "@/lib/laundry-rbac"

export const runtime = "nodejs"

const EXEC_HINT = /pickup|delivery|executive|rider|field|agent/i

export async function GET(request: Request) {
  try {
    const businessId = new URL(request.url).searchParams.get("businessId")
    const guard = await requireLaundryPermission(request, businessId, "laundry.staff.view")
    if (!guard.ok) return guard.res
    const platformBusinessId = guard.platformBusinessId
    const laundryBusinessId = guard.ctx.laundryBusinessId

    const [members, assignments, stores] = await Promise.all([
      prisma.businessUser.findMany({
        where: { businessId: platformBusinessId, role: { not: "CUSTOMER" } },
        include: { user: { select: { id: true, name: true, phone: true, isActive: true } } },
        orderBy: { createdAt: "asc" },
      }),
      prisma.laundryAccessAssignment.findMany({ where: { businessId: platformBusinessId }, include: { role: { select: { code: true, name: true, isOwner: true } } } }),
      prisma.laundryStore.findMany({ where: { laundryBusinessId }, select: { id: true, storeName: true } }),
    ])
    const aByUser = new Map(assignments.map((a) => [a.userId, a]))
    const storeName = new Map(stores.map((s) => [s.id, s.storeName]))

    const data = members
      .filter((bu) => bu.isActive && bu.user.isActive)
      .map((bu) => {
        const a = aByUser.get(bu.userId)
        const roleName = a?.role.name ?? null
        const roleCode = a?.role.code ?? null
        return {
          userId: bu.userId,
          name: bu.user.name,
          phone: bu.user.phone,
          roleName,
          storeId: a?.storeId ?? null,
          storeName: a?.storeId ? storeName.get(a.storeId) ?? null : null,
          isExecutive: EXEC_HINT.test(`${roleName ?? ""} ${roleCode ?? ""}`),
        }
      })
    // Executives first, then the rest (any active staff can be assigned).
    data.sort((x, y) => Number(y.isExecutive) - Number(x.isExecutive) || (x.name || "").localeCompare(y.name || ""))
    return NextResponse.json({ success: true, data, stores })
  } catch (e) {
    console.error("[laundry-executives] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
