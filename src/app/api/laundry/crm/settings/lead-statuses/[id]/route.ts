import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCrmBusiness } from "@/lib/laundry-crm"
import { crmError } from "@/lib/laundry-crm-settings"

export const runtime = "nodejs"

const KINDS = new Set(["OPEN", "CLOSED", "CONVERTED", "LOST"])

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
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
