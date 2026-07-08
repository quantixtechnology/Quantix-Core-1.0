// PUT: edit a field definition (label, flags, options, order…). The fieldKey
// and type are immutable after creation (historical values depend on them).
// DELETE: deactivate (never hard-delete — historical leads keep their values);
// system fields are protected entirely.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCrmBusiness } from "@/lib/laundry-crm"
import { crmError } from "@/lib/laundry-crm-settings"

export const runtime = "nodejs"

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const biz = await requireCrmBusiness(body.businessId)
    const row = await prisma.laundryCrmLeadField.findFirst({ where: { id, businessId: biz.id } })
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (row.isSystem && body.active === false) {
      return NextResponse.json({ error: "System fields cannot be deactivated" }, { status: 400 })
    }

    const data: Record<string, unknown> = {}
    if (typeof body.label === "string" && body.label.trim()) data.label = body.label.trim()
    for (const k of ["description", "placeholder", "defaultValue"] as const) {
      if (k in body) data[k] = body[k] != null && body[k] !== "" ? String(body[k]) : null
    }
    for (const k of ["required", "active", "searchable", "filterable", "showInList", "showInCreate", "showInEdit", "showInDetail"] as const) {
      if (typeof body[k] === "boolean") data[k] = body[k]
    }
    if (typeof body.displayOrder === "number") data.displayOrder = body.displayOrder
    if (Array.isArray(body.options)) {
      // Options can be added/renamed/reordered/deactivated — used options are
      // deactivated (active:false), never removed, so history stays intact.
      data.options = JSON.stringify(body.options)
    }
    if (body.validation !== undefined) data.validation = body.validation ? JSON.stringify(body.validation) : null
    if (row.isSystem && "required" in data && row.fieldKey === "first_name") delete data.required // display name source stays required

    const updated = await prisma.laundryCrmLeadField.update({ where: { id }, data })
    return NextResponse.json({ success: true, data: updated })
  } catch (e) { return crmError(e) }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const businessId = new URL(request.url).searchParams.get("businessId")
    const biz = await requireCrmBusiness(businessId)
    const row = await prisma.laundryCrmLeadField.findFirst({ where: { id, businessId: biz.id } })
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (row.isSystem) return NextResponse.json({ error: "System fields cannot be removed" }, { status: 400 })
    const updated = await prisma.laundryCrmLeadField.update({ where: { id }, data: { active: false } })
    return NextResponse.json({ success: true, data: updated })
  } catch (e) { return crmError(e) }
}
