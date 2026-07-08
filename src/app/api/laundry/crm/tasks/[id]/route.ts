// PUT: edit / complete / reopen / cancel a CRM task.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCrmBusiness, crmEvent } from "@/lib/laundry-crm"
import { crmError } from "@/lib/laundry-crm-settings"

export const runtime = "nodejs"

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const biz = await requireCrmBusiness(body.businessId)
    const task = await prisma.laundryCrmTask.findFirst({ where: { id, businessId: biz.id } })
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 })

    const data: Record<string, unknown> = {}
    if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim()
    if ("description" in body) data.description = body.description ? String(body.description) : null
    if (["LOW", "MEDIUM", "HIGH", "URGENT"].includes(body.priority)) data.priority = body.priority
    if ("dueAt" in body) data.dueAt = body.dueAt ? new Date(body.dueAt) : null
    if ("assignedToId" in body) { data.assignedToId = body.assignedToId || null; data.assignedToName = body.assignedToName || null }
    if (["OPEN", "COMPLETED", "CANCELLED"].includes(body.status) && body.status !== task.status) {
      data.status = body.status
      data.completedAt = body.status === "COMPLETED" ? new Date() : null
    }
    if (!Object.keys(data).length) return NextResponse.json({ error: "Nothing to update" }, { status: 400 })

    const updated = await prisma.laundryCrmTask.update({ where: { id }, data })
    if (data.status === "COMPLETED" && (task.leadId || task.opportunityId)) {
      await crmEvent(biz.id, "TASK_COMPLETED", `Task completed: ${updated.title}`, {
        leadId: task.leadId, opportunityId: task.opportunityId,
        actor: { id: body.actorId, name: body.actorName },
      })
    }
    return NextResponse.json({ success: true, data: updated })
  } catch (e) { return crmError(e) }
}
