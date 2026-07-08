// GET: lead detail + merged timeline (system events, activities, tasks).
// PUT: dynamic-field edit, status change, assignment — each recorded on the timeline.
// DELETE: archive (soft), never hard-delete.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  requireCrmBusiness, crmEvent, buildLeadValues, promoteSystemFields, CrmValidationError,
} from "@/lib/laundry-crm"
import { crmError } from "@/lib/laundry-crm-settings"

export const runtime = "nodejs"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const biz = await requireCrmBusiness(new URL(request.url).searchParams.get("businessId"))
    const lead = await prisma.laundryCrmLead.findFirst({
      where: { id, businessId: biz.id },
      include: {
        status: true, source: true,
        opportunity: { include: { stage: true, lostReason: true } },
        activities: { orderBy: { activityAt: "desc" }, take: 100 },
        tasks: { orderBy: [{ status: "asc" }, { dueAt: "asc" }], take: 100 },
        events: { orderBy: { createdAt: "desc" }, take: 200 },
      },
    })
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    return NextResponse.json({ success: true, data: lead })
  } catch (e) { return crmError(e) }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const biz = await requireCrmBusiness(body.businessId)
    const lead = await prisma.laundryCrmLead.findFirst({ where: { id, businessId: biz.id } })
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    const actor = { id: body.actorId, name: body.actorName }

    const data: Record<string, unknown> = {}
    const events: { kind: string; label: string; meta?: unknown }[] = []

    if (body.values && typeof body.values === "object") {
      const fields = await prisma.laundryCrmLeadField.findMany({ where: { businessId: biz.id, active: true } })
      const existing = JSON.parse(lead.fieldValues || "{}")
      let merged: Record<string, unknown>
      try {
        merged = buildLeadValues(fields, body.values, "edit", existing)
      } catch (err) {
        if (err instanceof CrmValidationError) return NextResponse.json({ error: err.message }, { status: 400 })
        throw err
      }
      const promoted = promoteSystemFields(merged)
      Object.assign(data, { fieldValues: JSON.stringify(merged) }, promoted)
      events.push({ kind: "LEAD_UPDATED", label: "Lead details updated" })
    }

    if (body.statusId && body.statusId !== lead.statusId) {
      const st = await prisma.laundryCrmLeadStatus.findFirst({ where: { id: body.statusId, businessId: biz.id, active: true } })
      if (!st) return NextResponse.json({ error: "Invalid lead status" }, { status: 400 })
      data.statusId = st.id
      events.push({ kind: "STATUS_CHANGED", label: `Status changed to ${st.name}`, meta: { from: lead.statusId, to: st.id } })
    }

    if ("sourceId" in body && body.sourceId !== lead.sourceId) {
      if (body.sourceId) {
        const src = await prisma.laundryCrmLeadSource.findFirst({ where: { id: body.sourceId, businessId: biz.id } })
        if (!src) return NextResponse.json({ error: "Invalid lead source" }, { status: 400 })
      }
      data.sourceId = body.sourceId || null
    }

    if ("assignedToId" in body && body.assignedToId !== lead.assignedToId) {
      data.assignedToId = body.assignedToId || null
      data.assignedToName = body.assignedToName || null
      events.push({
        kind: lead.assignedToId ? "REASSIGNED" : "ASSIGNED",
        label: body.assignedToName ? `Assigned to ${body.assignedToName}` : "Unassigned",
      })
    }

    if (typeof body.archived === "boolean" && body.archived !== lead.archived) {
      data.archived = body.archived
      events.push({ kind: body.archived ? "ARCHIVED" : "RESTORED", label: body.archived ? "Lead archived" : "Lead restored" })
    }

    if (!Object.keys(data).length) return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
    const updated = await prisma.laundryCrmLead.update({
      where: { id }, data, include: { status: true, source: true },
    })
    for (const ev of events) await crmEvent(biz.id, ev.kind, ev.label, { leadId: id, meta: ev.meta, actor })
    return NextResponse.json({ success: true, data: updated })
  } catch (e) { return crmError(e) }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const sp = new URL(request.url).searchParams
    const biz = await requireCrmBusiness(sp.get("businessId"))
    const lead = await prisma.laundryCrmLead.findFirst({ where: { id, businessId: biz.id } })
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    await prisma.laundryCrmLead.update({ where: { id }, data: { archived: true } })
    await crmEvent(biz.id, "ARCHIVED", "Lead archived", { leadId: id })
    return NextResponse.json({ success: true })
  } catch (e) { return crmError(e) }
}
