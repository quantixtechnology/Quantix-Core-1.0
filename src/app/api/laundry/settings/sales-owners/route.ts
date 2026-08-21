// GET /api/laundry/settings/sales-owners?businessId=
//
// The people who can be named as a customer's Sales Team Owner.
//
// SOURCE: CRM lead ownership — the same people who already own leads — NOT the
// Business User/staff list. A store manager or a delivery executive is not a
// sales owner, and offering the whole payroll made the field meaningless.
//
// There is no Lead Owner master to read: CRM records ownership as free text on
// the lead itself (assignedToName, with assignedToId set to the same string).
// So this returns the DISTINCT owners CRM actually holds. That has two honest
// consequences, and neither is hidden:
//
//   • a name appears only once it owns at least one lead — there is nowhere
//     else for a "configured owner" to exist yet;
//   • two spellings of one person are two owners, because CRM stores them that
//     way. A Lead Owner master would fix this at the source, in CRM, and this
//     endpoint would then read it without changing shape.
//
// Nothing here writes, and no CRM behaviour is touched.
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
    if (!biz) return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })

    // Leads carry the owner; opportunities inherit it at conversion. Reading
    // both means an owner whose leads have all converted still appears.
    const [leadOwners, oppOwners] = await Promise.all([
      prisma.laundryCrmLead.findMany({
        where: { businessId: biz.id, assignedToName: { not: null } },
        select: { assignedToId: true, assignedToName: true },
        distinct: ["assignedToName"],
      }),
      prisma.laundryCrmOpportunity.findMany({
        where: { businessId: biz.id, assignedToName: { not: null } },
        select: { assignedToId: true, assignedToName: true },
        distinct: ["assignedToName"],
      }),
    ])

    // One entry per name. CRM sets assignedToId to the name itself, so the id
    // stays consistent with how CRM already identifies an owner.
    const byName = new Map<string, { id: string; name: string }>()
    for (const row of [...leadOwners, ...oppOwners]) {
      const name = (row.assignedToName || "").trim()
      if (!name) continue
      if (!byName.has(name)) byName.set(name, { id: row.assignedToId || name, name })
    }

    const owners = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name))
    return NextResponse.json({ success: true, data: owners })
  } catch (e) {
    console.error("[sales-owners] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
