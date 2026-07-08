// Dynamic Lead Field definitions — the metadata that drives the Lead form.
// System fields (first_name/last_name/phone/email) are protected; everything
// else is tenant-manageable.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCrmBusiness, ensureCrmDefaults } from "@/lib/laundry-crm"
import { crmError } from "@/lib/laundry-crm-settings"

export const runtime = "nodejs"

const FIELD_TYPES = new Set([
  "TEXT", "TEXTAREA", "PHONE", "EMAIL", "NUMBER", "DECIMAL", "CURRENCY",
  "DATE", "DATETIME", "SELECT", "MULTISELECT", "RADIO", "CHECKBOX", "TOGGLE", "URL", "ADDRESS",
])

export async function GET(request: Request) {
  try {
    const sp = new URL(request.url).searchParams
    const biz = await requireCrmBusiness(sp.get("businessId"))
    await ensureCrmDefaults(biz.id)
    const where: Record<string, unknown> = { businessId: biz.id }
    if (sp.get("includeInactive") !== "1") where.active = true
    const rows = await prisma.laundryCrmLeadField.findMany({ where: where as never, orderBy: { displayOrder: "asc" } })
    return NextResponse.json({ success: true, data: rows })
  } catch (e) { return crmError(e) }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const biz = await requireCrmBusiness(body.businessId)
    const label = String(body.label || "").trim()
    if (!label) return NextResponse.json({ error: "Label is required" }, { status: 400 })
    const type = FIELD_TYPES.has(body.type) ? body.type : "TEXT"

    // Internal key: caller-provided or derived from the label; stable once created.
    let fieldKey = String(body.fieldKey || "").trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "")
    if (!fieldKey) fieldKey = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")
    if (!fieldKey) return NextResponse.json({ error: "Could not derive a field key" }, { status: 400 })
    const clash = await prisma.laundryCrmLeadField.findUnique({ where: { businessId_fieldKey: { businessId: biz.id, fieldKey } } })
    if (clash) return NextResponse.json({ error: `Field key "${fieldKey}" already exists` }, { status: 400 })

    const max = await prisma.laundryCrmLeadField.aggregate({ where: { businessId: biz.id }, _max: { displayOrder: true } })
    const row = await prisma.laundryCrmLeadField.create({
      data: {
        businessId: biz.id, fieldKey, label, type,
        description: body.description ? String(body.description) : null,
        placeholder: body.placeholder ? String(body.placeholder) : null,
        defaultValue: body.defaultValue != null && body.defaultValue !== "" ? String(body.defaultValue) : null,
        options: Array.isArray(body.options) ? JSON.stringify(body.options) : null,
        validation: body.validation ? JSON.stringify(body.validation) : null,
        required: !!body.required,
        searchable: !!body.searchable,
        filterable: !!body.filterable,
        showInList: !!body.showInList,
        showInCreate: body.showInCreate !== false,
        showInEdit: body.showInEdit !== false,
        showInDetail: body.showInDetail !== false,
        displayOrder: (max._max.displayOrder ?? -1) + 1,
      },
    })
    return NextResponse.json({ success: true, data: row })
  } catch (e) { return crmError(e) }
}
