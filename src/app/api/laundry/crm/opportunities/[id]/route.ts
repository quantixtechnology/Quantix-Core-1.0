// GET: opportunity detail + timeline. PUT: edit core fields / reassign.
// Stage movement is NOT done here — use the dedicated /stage endpoint so every
// transition is validated and recorded in stage history.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCrmBusiness, crmEvent, getCrmConfig, ownerPatchFromRequest } from "@/lib/laundry-crm"
import { crmError } from "@/lib/laundry-crm-settings"
import { requireLaundryPermission } from "@/lib/laundry-rbac"

export const runtime = "nodejs"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const guard = await requireLaundryPermission(request, new URL(request.url).searchParams.get("businessId"), "crm.opportunity.view")
    if (!guard.ok) return guard.res
    const biz = await requireCrmBusiness(new URL(request.url).searchParams.get("businessId"))
    const opp = await prisma.laundryCrmOpportunity.findFirst({
      where: { id, businessId: biz.id },
      include: {
        stage: true, lostReason: true, priority: true, lead: { include: { status: true, source: true } },
        stageHistory: { orderBy: { createdAt: "desc" } },
        activities: { orderBy: { activityAt: "desc" }, take: 100 },
        tasks: { orderBy: [{ status: "asc" }, { dueAt: "asc" }], take: 100, include: { taskType: true } },
        events: { orderBy: { createdAt: "desc" }, take: 200 },
      },
    })
    if (!opp) return NextResponse.json({ error: "Opportunity not found" }, { status: 404 })
    return NextResponse.json({ success: true, data: opp })
  } catch (e) { return crmError(e) }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const guard = await requireLaundryPermission(request, body.businessId, "crm.opportunity.edit")
    if (!guard.ok) return guard.res
    const biz = await requireCrmBusiness(body.businessId)
    const opp = await prisma.laundryCrmOpportunity.findFirst({ where: { id, businessId: biz.id } })
    if (!opp) return NextResponse.json({ error: "Opportunity not found" }, { status: 404 })
    const actor = { id: body.actorId, name: body.actorName }

    const data: Record<string, unknown> = {}
    if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim()
    if (body.value != null) data.value = Math.max(0, Number(body.value) || 0)
    // Probability is only writable in MANUAL mode. Under AUTO_FROM_STAGE it is
    // owned by the sales stage, so an edit can never desync it from the stage.
    if (body.probability != null) {
      const { probabilityMode } = await getCrmConfig(biz.id)
      if (probabilityMode === "MANUAL") data.probability = Math.min(100, Math.max(0, Number(body.probability) || 0))
    }
    if ("expectedCloseDate" in body) data.expectedCloseDate = body.expectedCloseDate ? new Date(body.expectedCloseDate) : null
    if ("notes" in body) data.notes = body.notes ? String(body.notes) : null
    // Ownership: the client may send anything; the resolver decides what (if
    // anything) is writable. In Phase 1 that is always nothing — the owner
    // mirrors the Lead Owner. This is the single seam Phase 2 opens.
    Object.assign(data, ownerPatchFromRequest(body))
    if ("priorityId" in body) {
      if (body.priorityId) {
        const pri = await prisma.laundryCrmPriority.findFirst({ where: { id: body.priorityId, businessId: biz.id, active: true } })
        if (!pri) return NextResponse.json({ error: "Invalid priority" }, { status: 400 })
      }
      data.priorityId = body.priorityId || null
    }
    if (!Object.keys(data).length) return NextResponse.json({ error: "Nothing to update" }, { status: 400 })

    const updated = await prisma.laundryCrmOpportunity.update({
      where: { id }, data, include: { stage: true, lead: true },
    })
    await crmEvent(biz.id, "OPP_UPDATED", "Opportunity updated", { opportunityId: id, actor })
    return NextResponse.json({ success: true, data: updated })
  } catch (e) { return crmError(e) }
}
