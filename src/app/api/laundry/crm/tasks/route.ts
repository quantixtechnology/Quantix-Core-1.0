// CRM Tasks — tenant-scoped, optionally related to a lead/opportunity.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCrmBusiness, ensureCrmDefaults, generateTaskCode, crmEvent } from "@/lib/laundry-crm"
import { crmError } from "@/lib/laundry-crm-settings"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const sp = new URL(request.url).searchParams
    const biz = await requireCrmBusiness(sp.get("businessId"))
    await ensureCrmDefaults(biz.id)
    const where: Record<string, unknown> = { businessId: biz.id }
    if (sp.get("leadId")) where.leadId = sp.get("leadId")
    if (sp.get("opportunityId")) where.opportunityId = sp.get("opportunityId")
    if (sp.get("status")) where.status = sp.get("status")
    if (sp.get("assignedToId")) where.assignedToId = sp.get("assignedToId")
    // due=today | overdue | upcoming
    const due = sp.get("due")
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(); endOfDay.setHours(23, 59, 59, 999)
    if (due === "today") where.dueAt = { gte: startOfDay, lte: endOfDay }
    if (due === "overdue") { where.dueAt = { lt: startOfDay }; where.status = "OPEN" }
    if (due === "upcoming") { where.dueAt = { gt: endOfDay }; where.status = "OPEN" }

    const page = Math.max(1, parseInt(sp.get("page") || "1"))
    const pageSize = Math.min(100, Math.max(1, parseInt(sp.get("pageSize") || "25")))
    const [rows, total] = await Promise.all([
      prisma.laundryCrmTask.findMany({
        where: where as never,
        include: {
          lead: { select: { id: true, leadCode: true, displayName: true } },
          opportunity: { select: { id: true, oppCode: true, name: true } },
        },
        orderBy: [{ status: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize, take: pageSize,
      }),
      prisma.laundryCrmTask.count({ where: where as never }),
    ])
    return NextResponse.json({ success: true, data: rows, total })
  } catch (e) { return crmError(e) }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const biz = await requireCrmBusiness(body.businessId)
    const title = String(body.title || "").trim()
    if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 })

    if (body.leadId) {
      const lead = await prisma.laundryCrmLead.findFirst({ where: { id: body.leadId, businessId: biz.id }, select: { id: true } })
      if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    }
    if (body.opportunityId) {
      const opp = await prisma.laundryCrmOpportunity.findFirst({ where: { id: body.opportunityId, businessId: biz.id }, select: { id: true } })
      if (!opp) return NextResponse.json({ error: "Opportunity not found" }, { status: 404 })
    }

    const row = await prisma.laundryCrmTask.create({
      data: {
        taskCode: await generateTaskCode(),
        businessId: biz.id,
        leadId: body.leadId || null,
        opportunityId: body.opportunityId || null,
        title,
        description: body.description ? String(body.description) : null,
        priority: ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(body.priority) ? body.priority : "MEDIUM",
        dueAt: body.dueAt ? new Date(body.dueAt) : null,
        assignedToId: body.assignedToId || null,
        assignedToName: body.assignedToName || null,
        createdById: body.actorId || null,
        createdByName: body.actorName || null,
      },
    })
    if (body.leadId || body.opportunityId) {
      await crmEvent(biz.id, "TASK_CREATED", `Task created: ${title}`, {
        leadId: body.leadId, opportunityId: body.opportunityId,
        actor: { id: body.actorId, name: body.actorName },
      })
    }
    return NextResponse.json({ success: true, data: row })
  } catch (e) { return crmError(e) }
}
