// Admin — Marketing promotions (vouchers/coupons) list + create.
// Additive; RBAC-guarded (laundry.settings). Business-scoped by platform id so
// every workspace reuses the same table. No engine changes.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireLaundryPermission } from "@/lib/laundry-rbac"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const businessId = new URL(request.url).searchParams.get("businessId")
    if (!businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
    const guard = await requireLaundryPermission(request, businessId, "laundry.settings.view")
    if (!guard.ok) return guard.res
    const bizId = guard.platformBusinessId
    const promotions = await prisma.promotion.findMany({
      where: { businessId: bizId },
      include: { rules: true, _count: { select: { redemptions: true } } },
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json({ success: true, data: promotions })
  } catch (e) {
    console.error("[marketing-promotions] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { businessId } = body
    if (!businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
    const guard = await requireLaundryPermission(request, businessId, "laundry.settings.edit")
    if (!guard.ok) return guard.res
    const bizId = guard.platformBusinessId

    const title = String(body.title || "").trim()
    if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 })
    const discountType = body.discountType === "FIXED" ? "FIXED" : "PERCENT"
    const discountValue = Math.max(0, Number(body.discountValue) || 0)
    const code = body.code ? String(body.code).trim().toUpperCase() : null

    if (code) {
      const dup = await prisma.promotion.findFirst({ where: { businessId: bizId, code } })
      if (dup) return NextResponse.json({ error: "A coupon with this code already exists." }, { status: 409 })
    }

    const applyTo = Array.isArray(body.applyTo) && body.applyTo.length ? body.applyTo : ["ORDER"]
    const promotion = await prisma.promotion.create({
      data: {
        businessId: bizId,
        workspaceType: body.workspaceType || null,
        kind: body.kind === "DISCOUNT" ? "DISCOUNT" : "VOUCHER",
        title, description: body.description || null, code,
        discountType, discountValue,
        maxDiscount: body.maxDiscount != null ? Number(body.maxDiscount) : null,
        minOrderValue: body.minOrderValue != null ? Number(body.minOrderValue) : null,
        status: body.status || "DRAFT",
        enabled: body.enabled !== false,
        startAt: body.startAt ? new Date(body.startAt) : null,
        endAt: body.endAt ? new Date(body.endAt) : null,
        maxUses: body.maxUses != null ? Number(body.maxUses) : null,
        maxUsesPerCustomer: body.maxUsesPerCustomer != null ? Number(body.maxUsesPerCustomer) : null,
        applyTo: JSON.stringify(applyTo),
        createdBy: body.actorName || null,
      },
    })
    return NextResponse.json({ success: true, data: promotion }, { status: 201 })
  } catch (e) {
    console.error("[marketing-promotions] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
