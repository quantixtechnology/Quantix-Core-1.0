// GET /api/laundry/crm/opportunities — tenant-scoped list (list + kanban feed).
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCrmBusiness, ensureCrmDefaults } from "@/lib/laundry-crm"
import { crmError } from "@/lib/laundry-crm-settings"
import { requireLaundryPermission } from "@/lib/laundry-rbac"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const sp = new URL(request.url).searchParams
    const guard = await requireLaundryPermission(request, sp.get("businessId"), "crm.opportunity.view")
    if (!guard.ok) return guard.res
    const biz = await requireCrmBusiness(sp.get("businessId"))
    await ensureCrmDefaults(biz.id)

    const q = (sp.get("q") || "").trim()
    const where: Record<string, unknown> = { businessId: biz.id }
    if (sp.get("stageId")) where.stageId = sp.get("stageId")
    if (sp.get("priorityId")) where.priorityId = sp.get("priorityId")
    if (sp.get("state")) where.state = sp.get("state")
    if (sp.get("assignedToId")) where.assignedToId = sp.get("assignedToId")
    const from = sp.get("from"); const to = sp.get("to")
    if (from || to) where.createdAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(`${to}T23:59:59.999`) } : {}),
    }
    if (q) where.OR = [{ name: { contains: q } }, { oppCode: { contains: q } }, { lead: { displayName: { contains: q } } }]

    const page = Math.max(1, parseInt(sp.get("page") || "1"))
    const pageSize = Math.min(200, Math.max(1, parseInt(sp.get("pageSize") || "100")))

    const [rows, total] = await Promise.all([
      prisma.laundryCrmOpportunity.findMany({
        where: where as never,
        include: {
          stage: true, lostReason: true, priority: true,
          // fieldValues carries Business Name; read through the lead, never duplicated.
          lead: { select: { id: true, leadCode: true, displayName: true, phone: true, email: true, fieldValues: true, source: true } },
        },
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.laundryCrmOpportunity.count({ where: where as never }),
    ])
    // Expected Revenue = Deal Value × Probability ÷ 100. Computed here from the
    // stored value/probability — nothing is persisted, so it always reflects the
    // current figures (a stage move updates probability and this follows).
    // null when there is no deal value, so the grid can show "—".
    const data = rows.map((o) => ({
      ...o,
      expectedRevenue: o.value ? (o.value * (o.probability ?? 0)) / 100 : null,
    }))
    return NextResponse.json({ success: true, data, total })
  } catch (e) { return crmError(e) }
}
