import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCrmBusiness } from "@/lib/laundry-crm"
import { crmError } from "@/lib/laundry-crm-settings"

export const runtime = "nodejs"

const TYPES = new Set(["OPEN", "WON", "LOST"])

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const biz = await requireCrmBusiness(body.businessId)
    const row = await prisma.laundryCrmSalesStage.findFirst({ where: { id, businessId: biz.id } })
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const nextType = typeof body.stageType === "string" && TYPES.has(body.stageType) ? body.stageType : row.stageType
    // Keep the pipeline usable: deactivating (or re-typing) must leave ≥1
    // active stage of each behaviour type.
    const willBeActive = typeof body.active === "boolean" ? body.active : row.active
    if ((!willBeActive && row.active) || (nextType !== row.stageType && row.active)) {
      const others = await prisma.laundryCrmSalesStage.count({
        where: { businessId: biz.id, active: true, stageType: row.stageType, id: { not: id } },
      })
      if (others === 0 && (!willBeActive || nextType !== row.stageType)) {
        return NextResponse.json({ error: `At least one active ${row.stageType} stage is required` }, { status: 400 })
      }
    }

    const data: Record<string, unknown> = {}
    if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim()
    if (typeof body.color === "string") data.color = body.color
    if (typeof body.displayOrder === "number") data.displayOrder = body.displayOrder
    if (typeof body.active === "boolean") data.active = body.active
    if (typeof body.probability === "number") data.probability = Math.min(100, Math.max(0, body.probability))
    if (nextType !== row.stageType) data.stageType = nextType

    const updated = await prisma.$transaction(async (tx) => {
      if (body.isInitial === true) {
        await tx.laundryCrmSalesStage.updateMany({ where: { businessId: biz.id, isInitial: true }, data: { isInitial: false } })
        data.isInitial = true
        data.active = true
      }
      return tx.laundryCrmSalesStage.update({ where: { id }, data })
    })
    return NextResponse.json({ success: true, data: updated })
  } catch (e) { return crmError(e) }
}
