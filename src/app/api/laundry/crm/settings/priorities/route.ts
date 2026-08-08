// Lead / Opportunity Priorities — fully configurable, tenant-scoped. No hardcoded
// priority values. Order via displayOrder, default via isDefault. Priorities hold
// an id-based relation on LaundryCrmLead / LaundryCrmOpportunity.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCrmBusiness, ensureCrmDefaults } from "@/lib/laundry-crm"
import { crmError } from "@/lib/laundry-crm-settings"
import { requireLaundryPermission } from "@/lib/laundry-rbac"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const sp = new URL(request.url).searchParams
    const guard = await requireLaundryPermission(request, sp.get("businessId"), "crm.settings.view")
    if (!guard.ok) return guard.res
    const biz = await requireCrmBusiness(sp.get("businessId"))
    await ensureCrmDefaults(biz.id)
    const where: Record<string, unknown> = { businessId: biz.id }
    if (sp.get("includeInactive") !== "1") where.active = true
    const rows = await prisma.laundryCrmPriority.findMany({ where: where as never, orderBy: { displayOrder: "asc" } })
    return NextResponse.json({ success: true, data: rows })
  } catch (e) { return crmError(e) }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const guard = await requireLaundryPermission(request, body.businessId, "crm.settings.edit")
    if (!guard.ok) return guard.res
    const biz = await requireCrmBusiness(body.businessId)
    const name = String(body.name || "").trim()
    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 })
    const max = await prisma.laundryCrmPriority.aggregate({ where: { businessId: biz.id }, _max: { displayOrder: true } })
    const row = await prisma.laundryCrmPriority.create({
      data: {
        businessId: biz.id, name,
        color: typeof body.color === "string" ? body.color : "#64748B",
        displayOrder: (max._max.displayOrder ?? -1) + 1,
      },
    })
    return NextResponse.json({ success: true, data: row })
  } catch (e) { return crmError(e) }
}