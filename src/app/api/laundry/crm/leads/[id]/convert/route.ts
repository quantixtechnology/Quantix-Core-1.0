// POST /api/laundry/crm/leads/[id]/convert — Lead → Opportunity.
// One primary Opportunity per Lead (leadId is unique on the Opportunity).
// No Contact/Company entities are created — by design.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCrmBusiness, generateOpportunityCode, crmEvent, getCrmConfig, ownerForNewOpportunity } from "@/lib/laundry-crm"
import { crmError } from "@/lib/laundry-crm-settings"
import { requireLaundryPermission } from "@/lib/laundry-rbac"

export const runtime = "nodejs"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const guard = await requireLaundryPermission(request, body.businessId, "crm.leads.edit")
    if (!guard.ok) return guard.res
    const biz = await requireCrmBusiness(body.businessId)
    const actor = { id: body.actorId, name: body.actorName }

    const lead = await prisma.laundryCrmLead.findFirst({
      where: { id, businessId: biz.id },
      include: { status: true, opportunity: { select: { id: true, oppCode: true } } },
    })
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    if (lead.archived) return NextResponse.json({ error: "Archived leads cannot be converted" }, { status: 400 })
    if (lead.converted || lead.opportunity) {
      return NextResponse.json({ error: `Lead is already converted (${lead.opportunity?.oppCode || ""})` }, { status: 409 })
    }
    if (lead.status && !lead.status.allowConversion) {
      return NextResponse.json({ error: `Leads in status "${lead.status.name}" cannot be converted` }, { status: 400 })
    }

    const name = String(body.name || "").trim() || `${lead.displayName} — Opportunity`
    const value = Math.max(0, Number(body.value) || 0)

    // Initial stage: explicit → validated; otherwise the configured initial
    // stage; otherwise the first active OPEN stage.
    let stage: { id: string; name: string; probability: number } | null = null
    if (body.stageId) {
      stage = await prisma.laundryCrmSalesStage.findFirst({ where: { id: body.stageId, businessId: biz.id, active: true, stageType: "OPEN" } })
      if (!stage) return NextResponse.json({ error: "Invalid initial sales stage" }, { status: 400 })
    } else {
      stage = await prisma.laundryCrmSalesStage.findFirst({
        where: { businessId: biz.id, active: true, stageType: "OPEN" },
        orderBy: [{ isInitial: "desc" }, { displayOrder: "asc" }],
      })
    }
    if (!stage) return NextResponse.json({ error: "No active open sales stage is configured" }, { status: 400 })

    // Opportunity priority: explicit → validated; otherwise inherit the lead's priority.
    let priorityId: string | null = body.priorityId || lead.priorityId || null
    if (priorityId) {
      const pri = await prisma.laundryCrmPriority.findFirst({ where: { id: priorityId, businessId: biz.id, active: true } })
      if (!pri) return NextResponse.json({ error: "Invalid priority" }, { status: 400 })
    } else {
      const def = await prisma.laundryCrmPriority.findFirst({
        where: { businessId: biz.id, active: true },
        orderBy: [{ isDefault: "desc" }, { displayOrder: "asc" }],
      })
      priorityId = def?.id || null
    }

    // Lead status flips to the tenant's CONVERTED-kind status when one exists.
    const convertedStatus = await prisma.laundryCrmLeadStatus.findFirst({
      where: { businessId: biz.id, kind: "CONVERTED" },
      orderBy: { displayOrder: "asc" },
    })

    // Probability: AUTO_FROM_STAGE always takes the initial stage's value;
    // MANUAL accepts an explicit one and otherwise still seeds from the stage.
    const { probabilityMode } = await getCrmConfig(biz.id)
    const probability = probabilityMode === "MANUAL" && body.probability != null
      ? Math.min(100, Math.max(0, Number(body.probability) || 0))
      : stage.probability

    const oppCode = await generateOpportunityCode()
    const opp = await prisma.$transaction(async (tx) => {
      const created = await tx.laundryCrmOpportunity.create({
        data: {
          oppCode, businessId: biz.id, leadId: lead.id, name, value,
          stageId: stage.id, probability,
          expectedCloseDate: body.expectedCloseDate ? new Date(body.expectedCloseDate) : null,
          notes: body.notes ? String(body.notes) : null,
          priorityId,
          // Ownership ALWAYS inherits the Lead Owner — resolved in one place so
          // Phase 2 (a dedicated opportunity owner) changes only that helper.
          // Anything the client sent for the owner is ignored.
          ...ownerForNewOpportunity(lead),
          // Created By is the user performing the conversion — never the owner.
          createdById: body.actorId || null,
          createdByName: body.actorName || null,
        },
      })
      await tx.laundryCrmStageHistory.create({
        data: {
          businessId: biz.id, opportunityId: created.id,
          toStageId: stage.id, toStageName: stage.name,
          changedById: body.actorId || null, changedByName: body.actorName || null,
        },
      })
      await tx.laundryCrmLead.update({
        where: { id: lead.id },
        data: { converted: true, convertedAt: new Date(), ...(convertedStatus ? { statusId: convertedStatus.id } : {}) },
      })
      return created
    })

    await crmEvent(biz.id, "CONVERTED", `Converted to opportunity ${oppCode}`, { leadId: lead.id, actor, meta: { opportunityId: opp.id } })
    await crmEvent(biz.id, "OPP_CREATED", `Opportunity created from lead ${lead.leadCode}`, { opportunityId: opp.id, actor })

    const full = await prisma.laundryCrmOpportunity.findUnique({ where: { id: opp.id }, include: { stage: true, lead: true } })
    return NextResponse.json({ success: true, data: full })
  } catch (e) { return crmError(e) }
}
