import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCrmBusiness } from "@/lib/laundry-crm"
import { crmError } from "@/lib/laundry-crm-settings"
import { requireLaundryPermission } from "@/lib/laundry-rbac"

export const runtime = "nodejs"

const KINDS = new Set(["OPEN", "CLOSED", "CONVERTED", "LOST"])

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const guard = await requireLaundryPermission(request, body.businessId, "crm.settings.edit")
    if (!guard.ok) return guard.res
    const biz = await requireCrmBusiness(body.businessId)
    const row = await prisma.laundryCrmLeadStatus.findFirst({ where: { id, businessId: biz.id } })
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 })

    if (body.active === false) {
      if (row.isSystem) return NextResponse.json({ error: "System statuses cannot be deactivated" }, { status: 400 })
      if (row.isDefault) return NextResponse.json({ error: "The default status cannot be deactivated. Set another default first." }, { status: 400 })
      const otherOpen = await prisma.laundryCrmLeadStatus.count({ where: { businessId: biz.id, active: true, kind: "OPEN", id: { not: id } } })
      if (row.kind === "OPEN" && otherOpen === 0) return NextResponse.json({ error: "At least one active open status is required" }, { status: 400 })
    }

    const data: Record<string, unknown> = {}
    if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim()
    if (typeof body.color === "string") data.color = body.color
    if (typeof body.icon === "string") data.icon = body.icon || null
    if (typeof body.displayOrder === "number") data.displayOrder = body.displayOrder
    if (typeof body.active === "boolean") data.active = body.active
    if (typeof body.allowConversion === "boolean") data.allowConversion = body.allowConversion
    if (typeof body.kind === "string" && KINDS.has(body.kind) && !row.isSystem) data.kind = body.kind

    const updated = await prisma.$transaction(async (tx) => {
      if (body.isDefault === true) {
        await tx.laundryCrmLeadStatus.updateMany({ where: { businessId: biz.id, isDefault: true }, data: { isDefault: false } })
        data.isDefault = true
        data.active = true
      }
      return tx.laundryCrmLeadStatus.update({ where: { id }, data })
    })
    return NextResponse.json({ success: true, data: updated })
  } catch (e) { return crmError(e) }
}

// DELETE the status. Existing leads must be moved to another active OPEN status
// (reassignStatusId). System/converted/lost statuses are protected.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const sp = new URL(request.url).searchParams
    const body = (await request.json().catch(() => ({}))) as { reassignStatusId?: string }
    const guard = await requireLaundryPermission(request, sp.get("businessId"), "crm.settings.edit")
    if (!guard.ok) return guard.res
    const biz = await requireCrmBusiness(sp.get("businessId"))
    const row = await prisma.laundryCrmLeadStatus.findFirst({ where: { id, businessId: biz.id } })
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (row.isSystem) return NextResponse.json({ error: "System status cannot be deleted. Deactivate it instead." }, { status: 400 })
    if (row.kind === "CONVERTED") return NextResponse.json({ error: "The converted status cannot be deleted" }, { status: 400 })

    const used = await prisma.laundryCrmLead.count({ where: { businessId: biz.id, statusId: id } })
    if (used > 0) {
      const reassignId = body.reassignStatusId
      if (!reassignId) {
        return NextResponse.json({ error: `${used} lead(s) are in this status. Choose a target status to move them.` }, { status: 400 })
      }
      const target = await prisma.laundryCrmLeadStatus.findFirst({ where: { id: reassignId, businessId: biz.id, active: true } })
      if (!target) return NextResponse.json({ error: "Target status not found or inactive" }, { status: 400 })
      await prisma.laundryCrmLead.updateMany({ where: { businessId: biz.id, statusId: id }, data: { statusId: reassignId } })
    }

    await prisma.laundryCrmLeadStatus.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e) { return crmError(e) }
}
