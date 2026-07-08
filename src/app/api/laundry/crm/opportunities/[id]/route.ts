// GET: opportunity detail + timeline. PUT: edit core fields / reassign.
// Stage movement is NOT done here — use the dedicated /stage endpoint so every
// transition is validated and recorded in stage history.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCrmBusiness, crmEvent } from "@/lib/laundry-crm"
import { crmError } from "@/lib/laundry-crm-settings"

export const runtime = "nodejs"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const biz = await requireCrmBusiness(new URL(request.url).searchParams.get("businessId"))
    const opp = await prisma.laundryCrmOpportunity.findFirst({
      where: { id, businessId: biz.id },
      include: {
        stage: true, lostReason: true, lead: { include: { status: true, source: true } },
        stageHistory: { orderBy: { createdAt: "desc" } },
        activities: { orderBy: { activityAt: "desc" }, take: 100 },
        tasks: { orderBy: [{ status: "asc" }, { dueAt: "asc" }], take: 100 },
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
    const biz = await requireCrmBusiness(body.businessId)
    const opp = await prisma.laundryCrmOpportunity.findFirst({ where: { id, businessId: biz.id } })
    if (!opp) return NextResponse.json({ error: "Opportunity not found" }, { status: 404 })
    const actor = { id: body.actorId, name: body.actorName }

    const data: Record<string, unknown> = {}
    if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim()
    if (body.value != null) data.value = Math.max(0, Number(body.value) || 0)
    if (body.probability != null) data.probability = Math.min(100, Math.max(0, Number(body.probability) || 0))
    if ("expectedCloseDate" in body) data.expectedCloseDate = body.expectedCloseDate ? new Date(body.expectedCloseDate) : null
    if ("notes" in body) data.notes = body.notes ? String(body.notes) : null
    if ("assignedToId" in body) {
      data.assignedToId = body.assignedToId || null
      data.assignedToName = body.assignedToName || null
    }
    if (!Object.keys(data).length) return NextResponse.json({ error: "Nothing to update" }, { status: 400 })

    const updated = await prisma.laundryCrmOpportunity.update({
      where: { id }, data, include: { stage: true, lead: true },
    })
    await crmEvent(biz.id, "OPP_UPDATED", "Opportunity updated", { opportunityId: id, actor })
    return NextResponse.json({ success: true, data: updated })
  } catch (e) { return crmError(e) }
}
