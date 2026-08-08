// GET: lead detail + merged timeline (system events, activities, tasks).
// PUT: dynamic-field edit, status change, assignment — each recorded on the timeline.
// DELETE: archive (soft), never hard-delete.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  requireCrmBusiness, crmEvent, buildLeadValues, promoteSystemFields, CrmValidationError,
  recordLeadStatusChange, normalizeChangeSource, movementLabel,
} from "@/lib/laundry-crm"
import { crmError } from "@/lib/laundry-crm-settings"
import { requireLaundryPermission } from "@/lib/laundry-rbac"

export const runtime = "nodejs"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const guard = await requireLaundryPermission(request, new URL(request.url).searchParams.get("businessId"), "crm.leads.view")
    if (!guard.ok) return guard.res
    const biz = await requireCrmBusiness(new URL(request.url).searchParams.get("businessId"))
    const lead = await prisma.laundryCrmLead.findFirst({
      where: { id, businessId: biz.id },
      include: {
        status: true, source: true, priority: true,
        opportunity: { include: { stage: true, lostReason: true } },
        statusHistory: { orderBy: { createdAt: "desc" }, take: 100 },
        activities: { orderBy: { activityAt: "desc" }, take: 100 },
        tasks: { orderBy: [{ status: "asc" }, { dueAt: "asc" }], take: 100, include: { taskType: true } },
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
    const guard = await requireLaundryPermission(request, body.businessId, "crm.leads.edit")
    if (!guard.ok) return guard.res
    const biz = await requireCrmBusiness(body.businessId)
    const lead = await prisma.laundryCrmLead.findFirst({ where: { id, businessId: biz.id }, include: { status: true } })
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    const actor = { id: body.actorId, name: body.actorName }
    const source = normalizeChangeSource(body.source)

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

    // Lead status change — audited with the SAME mechanism as opportunity
    // stages: an append-only row capturing both ends, who, when and from where.
    let statusAudit: { from: { id: string | null; name: string | null }; to: { id: string; name: string } } | null = null
    if (body.statusId && body.statusId !== lead.statusId) {
      const st = await prisma.laundryCrmLeadStatus.findFirst({ where: { id: body.statusId, businessId: biz.id, active: true } })
      if (!st) return NextResponse.json({ error: "Invalid lead status" }, { status: 400 })
      data.statusId = st.id
      statusAudit = {
        from: { id: lead.statusId, name: lead.status?.name || null },
        to: { id: st.id, name: st.name },
      }
      // Timeline names BOTH ends — never just the destination.
      events.push({
        kind: "STATUS_CHANGED",
        label: movementLabel("Lead", lead.status?.name, st.name),
        meta: { from: lead.status?.name, to: st.name, source },
      })
    }

    if ("sourceId" in body && body.sourceId !== lead.sourceId) {
      if (body.sourceId) {
        const src = await prisma.laundryCrmLeadSource.findFirst({ where: { id: body.sourceId, businessId: biz.id } })
        if (!src) return NextResponse.json({ error: "Invalid lead source" }, { status: 400 })
      }
      data.sourceId = body.sourceId || null
    }

    if ("priorityId" in body && body.priorityId !== lead.priorityId) {
      if (body.priorityId) {
        const pri = await prisma.laundryCrmPriority.findFirst({ where: { id: body.priorityId, businessId: biz.id, active: true } })
        if (!pri) return NextResponse.json({ error: "Invalid priority" }, { status: 400 })
      }
      data.priorityId = body.priorityId || null
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
    // The status change and its audit row commit together — a lead can never
    // change status without a permanent entry.
    const updated = await prisma.$transaction(async (tx) => {
      if (statusAudit) {
        await recordLeadStatusChange({
          businessId: biz.id, leadId: id,
          fromStatusId: statusAudit.from.id, fromStatusName: statusAudit.from.name,
          toStatusId: statusAudit.to.id, toStatusName: statusAudit.to.name,
          reason: body.reason ? String(body.reason) : null,
          comments: body.comments ? String(body.comments) : null,
          source, actor,
        }, tx)
      }
      return tx.laundryCrmLead.update({
        where: { id }, data, include: { status: true, source: true, priority: true },
      })
    })
    for (const ev of events) await crmEvent(biz.id, ev.kind, ev.label, { leadId: id, meta: ev.meta, actor })
    return NextResponse.json({ success: true, data: updated })
  } catch (e) { return crmError(e) }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const sp = new URL(request.url).searchParams
    const guard = await requireLaundryPermission(request, sp.get("businessId"), "crm.leads.delete")
    if (!guard.ok) return guard.res
    const biz = await requireCrmBusiness(sp.get("businessId"))
    const lead = await prisma.laundryCrmLead.findFirst({ where: { id, businessId: biz.id } })
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    await prisma.laundryCrmLead.update({ where: { id }, data: { archived: true } })
    await crmEvent(biz.id, "ARCHIVED", "Lead archived", { leadId: id })
    return NextResponse.json({ success: true })
  } catch (e) { return crmError(e) }
}
