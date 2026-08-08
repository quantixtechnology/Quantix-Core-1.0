// GET  /api/laundry/crm/leads — tenant-scoped list: search, filters (status/
//      source/assignee/date/custom filterable fields), sort, pagination.
// POST /api/laundry/crm/leads — create from the tenant's dynamic field config.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  requireCrmBusiness, ensureCrmDefaults, generateLeadCode, crmEvent,
  buildLeadValues, promoteSystemFields, CrmValidationError,
} from "@/lib/laundry-crm"
import { crmError } from "@/lib/laundry-crm-settings"
import { requireLaundryPermission } from "@/lib/laundry-rbac"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const sp = new URL(request.url).searchParams
    const guard = await requireLaundryPermission(request, sp.get("businessId"), "crm.leads.view")
    if (!guard.ok) return guard.res
    const biz = await requireCrmBusiness(sp.get("businessId"))
    await ensureCrmDefaults(biz.id)

    const q = (sp.get("q") || "").trim()
    const statusId = sp.get("statusId")
    const sourceId = sp.get("sourceId")
    const priorityId = sp.get("priorityId")
    const assignedToId = sp.get("assignedToId")
    const from = sp.get("from")
    const to = sp.get("to")
    const converted = sp.get("converted") // "1" | "0" | null
    const page = Math.max(1, parseInt(sp.get("page") || "1"))
    const pageSize = Math.min(100, Math.max(1, parseInt(sp.get("pageSize") || "20")))
    const sortBy = ["createdAt", "updatedAt", "displayName"].includes(sp.get("sortBy") || "") ? sp.get("sortBy")! : "createdAt"
    const sortDir = sp.get("sortDir") === "asc" ? "asc" : "desc"

    const where: Record<string, unknown> = { businessId: biz.id, archived: sp.get("archived") === "1" }
    if (statusId) where.statusId = statusId
    if (sourceId) where.sourceId = sourceId
    if (priorityId) where.priorityId = priorityId
    if (assignedToId) where.assignedToId = assignedToId
    if (converted === "1") where.converted = true
    if (converted === "0") where.converted = false
    if (from || to) where.createdAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(`${to}T23:59:59.999`) } : {}),
    }
    if (q) where.OR = [
      { displayName: { contains: q } }, { phone: { contains: q } },
      { email: { contains: q } }, { leadCode: { contains: q } },
      { fieldValues: { contains: q } },
    ]
    // Custom field filters: f_<fieldKey>=value (fields marked filterable).
    const fieldFilters: { key: string; value: string }[] = []
    sp.forEach((value, key) => { if (key.startsWith("f_") && value) fieldFilters.push({ key: key.slice(2), value }) })
    if (fieldFilters.length) {
      const filterable = await prisma.laundryCrmLeadField.findMany({
        where: { businessId: biz.id, filterable: true, fieldKey: { in: fieldFilters.map((f) => f.key) } },
        select: { fieldKey: true },
      })
      const allowed = new Set(filterable.map((f) => f.fieldKey))
      const ands = fieldFilters.filter((f) => allowed.has(f.key))
        .map((f) => ({ fieldValues: { contains: `"${f.key}":${JSON.stringify(f.value)}` } }))
      if (ands.length) where.AND = ands
    }

    const [rows, total] = await Promise.all([
      prisma.laundryCrmLead.findMany({
        where: where as never,
        include: { status: true, source: true, priority: true, opportunity: { select: { id: true, oppCode: true, state: true } } },
        orderBy: { [sortBy]: sortDir },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.laundryCrmLead.count({ where: where as never }),
    ])
    return NextResponse.json({ success: true, data: rows, total })
  } catch (e) { return crmError(e) }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const guard = await requireLaundryPermission(request, body.businessId, "crm.leads.create")
    if (!guard.ok) return guard.res
    const biz = await requireCrmBusiness(body.businessId)
    await ensureCrmDefaults(biz.id)

    const fields = await prisma.laundryCrmLeadField.findMany({ where: { businessId: biz.id, active: true } })
    let values: Record<string, unknown>
    try {
      values = buildLeadValues(fields, body.values || {}, "create")
    } catch (err) {
      if (err instanceof CrmValidationError) return NextResponse.json({ error: err.message }, { status: 400 })
      throw err
    }
    const promoted = promoteSystemFields(values)

    let statusId: string | null = body.statusId || null
    if (statusId) {
      const st = await prisma.laundryCrmLeadStatus.findFirst({ where: { id: statusId, businessId: biz.id, active: true } })
      if (!st) return NextResponse.json({ error: "Invalid lead status" }, { status: 400 })
    } else {
      const def = await prisma.laundryCrmLeadStatus.findFirst({
        where: { businessId: biz.id, active: true },
        orderBy: [{ isDefault: "desc" }, { displayOrder: "asc" }],
      })
      statusId = def?.id || null
    }
    if (body.sourceId) {
      const src = await prisma.laundryCrmLeadSource.findFirst({ where: { id: body.sourceId, businessId: biz.id } })
      if (!src) return NextResponse.json({ error: "Invalid lead source" }, { status: 400 })
    }

    let priorityId: string | null = body.priorityId || null
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

    const lead = await prisma.laundryCrmLead.create({
      data: {
        leadCode: await generateLeadCode(),
        businessId: biz.id,
        statusId,
        sourceId: body.sourceId || null,
        priorityId,
        fieldValues: JSON.stringify(values),
        ...promoted,
        assignedToId: body.assignedToId || null,
        assignedToName: body.assignedToName || null,
        createdById: body.actorId || null,
        createdByName: body.actorName || null,
      },
      include: { status: true, source: true, priority: true },
    })
    await crmEvent(biz.id, "LEAD_CREATED", `Lead created (${lead.leadCode})`, {
      leadId: lead.id, actor: { id: body.actorId, name: body.actorName },
    })
    return NextResponse.json({ success: true, data: lead })
  } catch (e) { return crmError(e) }
}
