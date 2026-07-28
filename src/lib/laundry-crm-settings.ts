// Shared handlers for the simple CRM config collections (sources, lost
// reasons, activity types) + the common error mapper. Statuses, stages and
// lead fields have behaviour guards and get dedicated route logic.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCrmBusiness, ensureCrmDefaults, CrmAccessError } from "@/lib/laundry-crm"
import { requireLaundryLevel, Level } from "@/lib/laundry-rbac"

export function crmError(e: unknown) {
  if (e instanceof CrmAccessError) return NextResponse.json({ error: e.message }, { status: e.status })
  console.error("[laundry-crm]", e)
  return NextResponse.json({ error: "Internal server error" }, { status: 500 })
}

type SimpleModel = "laundryCrmLeadSource" | "laundryCrmLostReason" | "laundryCrmActivityType"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = (m: SimpleModel) => (prisma as any)[m]

export function makeSimpleConfigCollection(model: SimpleModel, hasColor = false) {
  return {
    async GET(request: Request) {
      try {
        const sp = new URL(request.url).searchParams
        const guard = await requireLaundryLevel(request, sp.get("businessId"), "crm.settings", Level.VIEW)
        if (!guard.ok) return guard.res
        const biz = await requireCrmBusiness(sp.get("businessId"))
        await ensureCrmDefaults(biz.id)
        const where: Record<string, unknown> = { businessId: biz.id }
        if (sp.get("includeInactive") !== "1") where.active = true
        const rows = await table(model).findMany({ where, orderBy: { displayOrder: "asc" } })
        return NextResponse.json({ success: true, data: rows })
      } catch (e) { return crmError(e) }
    },
    async POST(request: Request) {
      try {
        const body = await request.json()
        const guard = await requireLaundryLevel(request, body.businessId, "crm.settings", Level.EDIT)
        if (!guard.ok) return guard.res
        const biz = await requireCrmBusiness(body.businessId)
        const name = String(body.name || "").trim()
        if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 })
        const max = await table(model).aggregate({ where: { businessId: biz.id }, _max: { displayOrder: true } })
        const data: Record<string, unknown> = { businessId: biz.id, name, displayOrder: (max._max.displayOrder ?? -1) + 1 }
        if (hasColor && body.color) data.color = String(body.color)
        const row = await table(model).create({ data })
        return NextResponse.json({ success: true, data: row })
      } catch (e) { return crmError(e) }
    },
  }
}

export function makeSimpleConfigItem(model: SimpleModel, hasColor = false) {
  return {
    async PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
      try {
        const { id } = await params
        const body = await request.json()
        const guard = await requireLaundryLevel(request, body.businessId, "crm.settings", Level.EDIT)
        if (!guard.ok) return guard.res
        const biz = await requireCrmBusiness(body.businessId)
        const row = await table(model).findFirst({ where: { id, businessId: biz.id } })
        if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 })
        const data: Record<string, unknown> = {}
        if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim()
        if (typeof body.active === "boolean") data.active = body.active
        if (typeof body.displayOrder === "number") data.displayOrder = body.displayOrder
        if (hasColor && typeof body.color === "string") data.color = body.color
        const updated = await table(model).update({ where: { id }, data })
        return NextResponse.json({ success: true, data: updated })
      } catch (e) { return crmError(e) }
    },
  }
}
