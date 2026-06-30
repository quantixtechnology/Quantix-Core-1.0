// GET    /api/laundry/pricing/[id]?history=1  — rule + audit history
// PUT    /api/laundry/pricing/[id]            — update (version++, audit)
// DELETE /api/laundry/pricing/[id]            — delete (blocked if used by orders)
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { buildRuleData, writeRuleAudit } from "@/lib/laundry-pricing-rule"

export const runtime = "nodejs"

const RULE_INCLUDE = {
  service: { select: { id: true, name: true } },
  garment: { select: { id: true, name: true } },
  category: { select: { id: true, name: true } },
  store: { select: { id: true, storeName: true } },
} as const

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const wantHistory = new URL(request.url).searchParams.get("history") === "1"
    const rule = await prisma.laundryPricingRule.findUnique({ where: { id }, include: RULE_INCLUDE })
    if (!rule) return NextResponse.json({ error: "Pricing rule not found" }, { status: 404 })
    const history = wantHistory
      ? await prisma.laundryPricingRuleAudit.findMany({ where: { ruleId: id }, orderBy: { createdAt: "desc" } })
      : undefined
    return NextResponse.json({ success: true, data: rule, history })
  } catch (e) {
    console.error("[laundry-pricing] GET[id]", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const b = await request.json()
    const existing = await prisma.laundryPricingRule.findUnique({ where: { id }, select: { status: true } })
    if (!existing) return NextResponse.json({ error: "Pricing rule not found" }, { status: 404 })

    const data = await prisma.laundryPricingRule.update({
      where: { id },
      data: {
        ...buildRuleData(b),
        version: { increment: 1 },
        modifiedById: b.actorId || null,
        modifiedByName: b.actorName || null,
      },
      include: RULE_INCLUDE,
    })

    // Classify the change for the audit log.
    let action = "UPDATE"
    if (b.status && b.status !== existing.status) {
      if (b.status === "ARCHIVED") action = "ARCHIVE"
      else if (existing.status === "ARCHIVED") action = "RESTORE"
    }
    await writeRuleAudit(prisma, data, action, b.actorId, b.actorName)
    return NextResponse.json({ success: true, data })
  } catch (e) {
    console.error("[laundry-pricing] PUT", e)
    return NextResponse.json({ error: "Failed to update pricing rule" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    // Never permanently delete a rule already used by orders — archive instead.
    const usedBy = await prisma.laundryOrderItem.count({ where: { pricingRuleId: id } })
    if (usedBy > 0) {
      return NextResponse.json(
        { error: `This rule is used by ${usedBy} order line(s) and cannot be deleted. Archive it instead.`, code: "RULE_IN_USE" },
        { status: 409 },
      )
    }
    await prisma.laundryPricingRuleAudit.deleteMany({ where: { ruleId: id } })
    await prisma.laundryPricingRule.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error("[laundry-pricing] DELETE", e)
    return NextResponse.json({ error: "Failed to delete pricing rule" }, { status: 500 })
  }
}
