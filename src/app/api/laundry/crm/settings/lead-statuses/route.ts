// Lead Statuses — tenant-configurable with behaviour keys (kind), never
// matched by display name. Guards: exactly one default; system rows protected.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCrmBusiness, ensureCrmDefaults } from "@/lib/laundry-crm"
import { crmError } from "@/lib/laundry-crm-settings"

export const runtime = "nodejs"

const KINDS = new Set(["OPEN", "CLOSED", "CONVERTED", "LOST"])

export async function GET(request: Request) {
  try {
    const sp = new URL(request.url).searchParams
    const biz = await requireCrmBusiness(sp.get("businessId"))
    await ensureCrmDefaults(biz.id)
    const where: Record<string, unknown> = { businessId: biz.id }
    if (sp.get("includeInactive") !== "1") where.active = true
    const rows = await prisma.laundryCrmLeadStatus.findMany({ where: where as never, orderBy: { displayOrder: "asc" } })
    return NextResponse.json({ success: true, data: rows })
  } catch (e) { return crmError(e) }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const biz = await requireCrmBusiness(body.businessId)
    const name = String(body.name || "").trim()
    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 })
    const kind = KINDS.has(body.kind) ? body.kind : "OPEN"
    const max = await prisma.laundryCrmLeadStatus.aggregate({ where: { businessId: biz.id }, _max: { displayOrder: true } })
    const row = await prisma.laundryCrmLeadStatus.create({
      data: {
        businessId: biz.id, name, kind,
        color: typeof body.color === "string" ? body.color : "#64748B",
        allowConversion: body.allowConversion !== false && kind === "OPEN",
        displayOrder: (max._max.displayOrder ?? -1) + 1,
      },
    })
    return NextResponse.json({ success: true, data: row })
  } catch (e) { return crmError(e) }
}
