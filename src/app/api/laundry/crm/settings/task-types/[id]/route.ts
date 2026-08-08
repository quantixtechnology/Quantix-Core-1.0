// PUT / DELETE /api/laundry/crm/settings/task-types/[id]
// PUT updates name/color/order/active. DELETE removes a task type (with an
// optional reassign target — existing tasks move to it).
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCrmBusiness } from "@/lib/laundry-crm"
import { crmError } from "@/lib/laundry-crm-settings"
import { requireLaundryPermission } from "@/lib/laundry-rbac"

export const runtime = "nodejs"

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const guard = await requireLaundryPermission(request, body.businessId, "crm.settings.edit")
    if (!guard.ok) return guard.res
    const biz = await requireCrmBusiness(body.businessId)
    const row = await prisma.laundryCrmTaskType.findFirst({ where: { id, businessId: biz.id } })
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const data: Record<string, unknown> = {}
    if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim()
    if (typeof body.color === "string") data.color = body.color
    if (typeof body.displayOrder === "number") data.displayOrder = body.displayOrder
    if (typeof body.active === "boolean") data.active = body.active
    const updated = await prisma.laundryCrmTaskType.update({ where: { id }, data })
    return NextResponse.json({ success: true, data: updated })
  } catch (e) { return crmError(e) }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const sp = new URL(request.url).searchParams
    const body = (await request.json().catch(() => ({}))) as { reassignTaskTypeId?: string }
    const guard = await requireLaundryPermission(request, sp.get("businessId"), "crm.settings.edit")
    if (!guard.ok) return guard.res
    const biz = await requireCrmBusiness(sp.get("businessId"))
    const row = await prisma.laundryCrmTaskType.findFirst({ where: { id, businessId: biz.id } })
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (row.isSystem) return NextResponse.json({ error: "System task types cannot be deleted" }, { status: 400 })

    const reassignId = body.reassignTaskTypeId || null
    if (reassignId) {
      const target = await prisma.laundryCrmTaskType.findFirst({ where: { id: reassignId, businessId: biz.id } })
      if (!target) return NextResponse.json({ error: "Target task type not found" }, { status: 400 })
    }

    const used = await prisma.laundryCrmTask.count({ where: { businessId: biz.id, taskTypeId: id } })
    if (used > 0 && !reassignId) {
      return NextResponse.json({ error: `${used} task(s) use this type. Choose a target to move them.` }, { status: 400 })
    }

    await prisma.$transaction(async (tx) => {
      if (reassignId) {
        await tx.laundryCrmTask.updateMany({ where: { businessId: biz.id, taskTypeId: id }, data: { taskTypeId: reassignId } })
      }
      await tx.laundryCrmTaskType.delete({ where: { id } })
    })
    return NextResponse.json({ success: true })
  } catch (e) { return crmError(e) }
}