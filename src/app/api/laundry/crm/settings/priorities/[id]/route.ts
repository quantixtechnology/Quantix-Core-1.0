// PUT / DELETE /api/laundry/crm/settings/priorities/[id]
// PUT updates name/color/order/active/isDefault. DELETE removes a priority
// (with an optional reassignId — existing leads/opportunities move to it).
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
    const row = await prisma.laundryCrmPriority.findFirst({ where: { id, businessId: biz.id } })
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 })

    if (body.active === false && row.isDefault) {
      return NextResponse.json({ error: "Deactivate or change the default priority first" }, { status: 400 })
    }

    const data: Record<string, unknown> = {}
    if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim()
    if (typeof body.color === "string") data.color = body.color
    if (typeof body.displayOrder === "number") data.displayOrder = body.displayOrder
    if (typeof body.active === "boolean") data.active = body.active

    const updated = await prisma.$transaction(async (tx) => {
      if (body.isDefault === true) {
        await tx.laundryCrmPriority.updateMany({ where: { businessId: biz.id, isDefault: true }, data: { isDefault: false } })
        data.isDefault = true
        data.active = true
      }
      return tx.laundryCrmPriority.update({ where: { id }, data })
    })
    return NextResponse.json({ success: true, data: updated })
  } catch (e) { return crmError(e) }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const sp = new URL(request.url).searchParams
    const body = (await request.json().catch(() => ({}))) as { reassignPriorityId?: string }
    const guard = await requireLaundryPermission(request, sp.get("businessId"), "crm.settings.edit")
    if (!guard.ok) return guard.res
    const biz = await requireCrmBusiness(sp.get("businessId"))
    const row = await prisma.laundryCrmPriority.findFirst({ where: { id, businessId: biz.id } })
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (row.isSystem) return NextResponse.json({ error: "System priorities cannot be deleted" }, { status: 400 })

    const reassignId = body.reassignPriorityId || null
    if (reassignId) {
      const target = await prisma.laundryCrmPriority.findFirst({ where: { id: reassignId, businessId: biz.id } })
      if (!target) return NextResponse.json({ error: "Target priority not found" }, { status: 400 })
    }

    const used = await prisma.laundryCrmLead.count({ where: { businessId: biz.id, priorityId: id } })
      + await prisma.laundryCrmOpportunity.count({ where: { businessId: biz.id, priorityId: id } })
    if (used > 0 && !reassignId) {
      return NextResponse.json({ error: `${used} record(s) use this priority. Choose a target to move them.` }, { status: 400 })
    }

    await prisma.$transaction(async (tx) => {
      if (reassignId) {
        await tx.laundryCrmLead.updateMany({ where: { businessId: biz.id, priorityId: id }, data: { priorityId: reassignId } })
        await tx.laundryCrmOpportunity.updateMany({ where: { businessId: biz.id, priorityId: id }, data: { priorityId: reassignId } })
      }
      await tx.laundryCrmPriority.delete({ where: { id } })
    })
    return NextResponse.json({ success: true })
  } catch (e) { return crmError(e) }
}