// GET /api/laundry/settings/sales-owners?businessId=
//
// The people who can be named as a customer's Sales Team Owner.
//
// This is the EXISTING staff list — BusinessUser rows for the tenant, the same
// records the Staff screen manages. There is deliberately no separate sales-team
// master: a second list of the same people would drift from the first the moment
// somebody joined or left, and then two screens would disagree about who works
// here.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryMember } from "@/lib/laundry-rbac"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const businessId = new URL(request.url).searchParams.get("businessId")
    const guard = await requireLaundryMember(request, businessId)
    if (!guard.ok) return guard.res
    if (!businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })

    const biz = await resolveLaundryBusiness(businessId)
    if (!biz?.platformBusinessId) return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })

    const staff = await prisma.businessUser.findMany({
      where: { businessId: biz.platformBusinessId, role: { not: "CUSTOMER" } },
      include: { user: { select: { id: true, name: true, email: true, isActive: true } } },
    })

    // Active staff only: naming someone who has left as the owner of a NEW
    // customer is a mistake waiting to happen. Customers already carrying a
    // departed owner keep the name — it is stored alongside the id for exactly
    // that reason.
    const owners = staff
      .filter((s) => s.user?.isActive)
      .map((s) => ({ id: s.user!.id, name: s.user!.name || s.user!.email || "Unnamed", email: s.user!.email }))
      .sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json({ success: true, data: owners })
  } catch (e) {
    console.error("[sales-owners] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
