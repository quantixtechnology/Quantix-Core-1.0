// Admin — update / delete a single promotion. Additive; RBAC-guarded.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireLaundryPermission } from "@/lib/laundry-rbac"

export const runtime = "nodejs"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { businessId } = body
    if (!businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
    const guard = await requireLaundryPermission(request, businessId, "laundry.settings.edit")
    if (!guard.ok) return guard.res
    const existing = await prisma.promotion.findFirst({ where: { id, businessId: guard.platformBusinessId } })
    if (!existing) return NextResponse.json({ error: "Promotion not found" }, { status: 404 })

    const data: Record<string, unknown> = {}
    const fields = ["title", "description", "workspaceType", "status", "kind"] as const
    for (const f of fields) if (body[f] !== undefined) data[f] = body[f]
    if (body.enabled !== undefined) data.enabled = !!body.enabled
    if (body.discountType !== undefined) data.discountType = body.discountType === "FIXED" ? "FIXED" : "PERCENT"
    if (body.discountValue !== undefined) data.discountValue = Math.max(0, Number(body.discountValue) || 0)
    if (body.maxDiscount !== undefined) data.maxDiscount = body.maxDiscount != null ? Number(body.maxDiscount) : null
    if (body.minOrderValue !== undefined) data.minOrderValue = body.minOrderValue != null ? Number(body.minOrderValue) : null
    if (body.startAt !== undefined) data.startAt = body.startAt ? new Date(body.startAt) : null
    if (body.endAt !== undefined) data.endAt = body.endAt ? new Date(body.endAt) : null
    if (body.maxUses !== undefined) data.maxUses = body.maxUses != null ? Number(body.maxUses) : null
    if (body.maxUsesPerCustomer !== undefined) data.maxUsesPerCustomer = body.maxUsesPerCustomer != null ? Number(body.maxUsesPerCustomer) : null
    if (body.applyTo !== undefined) data.applyTo = JSON.stringify(Array.isArray(body.applyTo) && body.applyTo.length ? body.applyTo : ["ORDER"])
    if (body.code !== undefined) {
      const code = body.code ? String(body.code).trim().toUpperCase() : null
      if (code && code !== existing.code) {
        const dup = await prisma.promotion.findFirst({ where: { businessId: guard.platformBusinessId, code, NOT: { id } } })
        if (dup) return NextResponse.json({ error: "A coupon with this code already exists." }, { status: 409 })
      }
      data.code = code
    }

    const updated = await prisma.promotion.update({ where: { id }, data })
    return NextResponse.json({ success: true, data: updated })
  } catch (e) {
    console.error("[marketing-promotion] PATCH", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const businessId = new URL(request.url).searchParams.get("businessId")
    if (!businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
    const guard = await requireLaundryPermission(request, businessId, "laundry.settings.edit")
    if (!guard.ok) return guard.res
    const existing = await prisma.promotion.findFirst({ where: { id, businessId: guard.platformBusinessId } })
    if (!existing) return NextResponse.json({ error: "Promotion not found" }, { status: 404 })
    // Soft-cancel keeps the redemption ledger intact for reports.
    await prisma.promotion.update({ where: { id }, data: { status: "CANCELLED", enabled: false } })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error("[marketing-promotion] DELETE", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
