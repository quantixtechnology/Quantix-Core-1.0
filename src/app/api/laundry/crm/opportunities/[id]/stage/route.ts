// POST /api/laundry/crm/opportunities/[id]/stage — the ONLY way an opportunity
// changes stage (kanban drag included). Server-side validation, stage history
// with time-in-stage, Won capture (date/final value/notes) and Lost capture
// (reason required). Behaviour comes from stageType, never the stage label.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCrmBusiness, crmEvent } from "@/lib/laundry-crm"
import { crmError } from "@/lib/laundry-crm-settings"

export const runtime = "nodejs"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const biz = await requireCrmBusiness(body.businessId)
    const actor = { id: body.actorId, name: body.actorName }

    const opp = await prisma.laundryCrmOpportunity.findFirst({
      where: { id, businessId: biz.id }, include: { stage: true },
    })
    if (!opp) return NextResponse.json({ error: "Opportunity not found" }, { status: 404 })

    const stage = await prisma.laundryCrmSalesStage.findFirst({
      where: { id: String(body.stageId || ""), businessId: biz.id, active: true },
    })
    if (!stage) return NextResponse.json({ error: "Invalid sales stage" }, { status: 400 })
    if (stage.id === opp.stageId) return NextResponse.json({ error: "Opportunity is already in this stage" }, { status: 400 })

    const now = new Date()
    const data: Record<string, unknown> = {
      stageId: stage.id, stageEnteredAt: now, state: stage.stageType, probability: stage.probability,
    }
    if (stage.stageType === "WON") {
      data.wonAt = now
      data.wonValue = body.finalValue != null ? Math.max(0, Number(body.finalValue) || 0) : opp.value
      data.lostAt = null; data.lostReasonId = null; data.lostNotes = null
      if (body.notes) data.notes = String(body.notes)
    } else if (stage.stageType === "LOST") {
      const reason = await prisma.laundryCrmLostReason.findFirst({
        where: { id: String(body.lostReasonId || ""), businessId: biz.id },
      })
      if (!reason) return NextResponse.json({ error: "A lost reason is required" }, { status: 400 })
      data.lostAt = now
      data.lostReasonId = reason.id
      data.lostNotes = body.lostNotes ? String(body.lostNotes) : null
      data.wonAt = null; data.wonValue = null
    } else {
      // Re-opened: clear terminal capture.
      data.wonAt = null; data.wonValue = null
      data.lostAt = null; data.lostReasonId = null; data.lostNotes = null
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.laundryCrmStageHistory.create({
        data: {
          businessId: biz.id, opportunityId: opp.id,
          fromStageId: opp.stageId, fromStageName: opp.stage?.name || null,
          toStageId: stage.id, toStageName: stage.name,
          durationMs: now.getTime() - new Date(opp.stageEnteredAt).getTime(),
          changedById: body.actorId || null, changedByName: body.actorName || null,
        },
      })
      return tx.laundryCrmOpportunity.update({
        where: { id: opp.id }, data, include: { stage: true, lostReason: true, lead: true },
      })
    })

    const kind = stage.stageType === "WON" ? "WON" : stage.stageType === "LOST" ? "LOST" : "STAGE_CHANGED"
    await crmEvent(biz.id, kind, `Moved to ${stage.name}`, {
      opportunityId: opp.id, actor,
      meta: { from: opp.stage?.name, to: stage.name, stageType: stage.stageType },
    })
    if (opp.leadId && (kind === "WON" || kind === "LOST")) {
      await crmEvent(biz.id, `OPP_${kind}`, `Opportunity ${updated.oppCode} marked ${stage.stageType === "WON" ? "won" : "lost"}`, { leadId: opp.leadId, actor })
    }
    return NextResponse.json({ success: true, data: updated })
  } catch (e) { return crmError(e) }
}
