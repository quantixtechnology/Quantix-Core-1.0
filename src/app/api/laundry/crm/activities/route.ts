// CRM Activities — manual logging (Call/Meeting/WhatsApp/Email/Follow-up/…).
// Architecture-ready for future WhatsApp/Email API integration; no sending is
// claimed or implemented here.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCrmBusiness, ensureCrmDefaults, generateActivityCode, crmEvent } from "@/lib/laundry-crm"
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
    if (sp.get("type")) where.type = sp.get("type")
    const q = (sp.get("q") || "").trim()
    if (q) where.OR = [{ subject: { contains: q } }, { description: { contains: q } }, { actCode: { contains: q } }]
    const page = Math.max(1, parseInt(sp.get("page") || "1"))
    const pageSize = Math.min(100, Math.max(1, parseInt(sp.get("pageSize") || "25")))
    const [rows, total] = await Promise.all([
      prisma.laundryCrmActivity.findMany({
        where: where as never,
        include: {
          lead: { select: { id: true, leadCode: true, displayName: true } },
          opportunity: { select: { id: true, oppCode: true, name: true } },
        },
        orderBy: { activityAt: "desc" },
        skip: (page - 1) * pageSize, take: pageSize,
      }),
      prisma.laundryCrmActivity.count({ where: where as never }),
    ])
    return NextResponse.json({ success: true, data: rows, total })
  } catch (e) { return crmError(e) }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const biz = await requireCrmBusiness(body.businessId)
    const subject = String(body.subject || "").trim()
    if (!subject) return NextResponse.json({ error: "Subject is required" }, { status: 400 })
    if (!body.leadId && !body.opportunityId) return NextResponse.json({ error: "Activity must relate to a lead or an opportunity" }, { status: 400 })

    // Ownership: related records must belong to this tenant.
    if (body.leadId) {
      const lead = await prisma.laundryCrmLead.findFirst({ where: { id: body.leadId, businessId: biz.id }, select: { id: true } })
      if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    }
    if (body.opportunityId) {
      const opp = await prisma.laundryCrmOpportunity.findFirst({ where: { id: body.opportunityId, businessId: biz.id }, select: { id: true } })
      if (!opp) return NextResponse.json({ error: "Opportunity not found" }, { status: 404 })
    }

    const row = await prisma.laundryCrmActivity.create({
      data: {
        actCode: await generateActivityCode(),
        businessId: biz.id,
        leadId: body.leadId || null,
        opportunityId: body.opportunityId || null,
        type: String(body.type || "General"),
        subject,
        description: body.description ? String(body.description) : null,
        outcome: body.outcome ? String(body.outcome) : null,
        activityAt: body.activityAt ? new Date(body.activityAt) : new Date(),
        assignedToId: body.assignedToId || null,
        assignedToName: body.assignedToName || null,
        createdById: body.actorId || null,
        createdByName: body.actorName || null,
      },
    })
    await crmEvent(biz.id, "ACTIVITY_LOGGED", `${row.type}: ${subject}`, {
      leadId: body.leadId, opportunityId: body.opportunityId,
      actor: { id: body.actorId, name: body.actorName },
    })
    return NextResponse.json({ success: true, data: row })
  } catch (e) { return crmError(e) }
}
