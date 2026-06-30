// GET  /api/laundry/pricing?businessId=  — list pricing rules (with relations)
// POST /api/laundry/pricing               — create pricing rule
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"

export const runtime = "nodejs"

const NUM = (v: unknown) => (v === "" || v === null || v === undefined ? null : Number(v))

export async function GET(request: Request) {
  try {
    const businessId = new URL(request.url).searchParams.get("businessId")
    if (!businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ success: true, data: [] })
    const data = await prisma.laundryPricingRule.findMany({
      where: { businessId: biz.id },
      include: {
        service: { select: { id: true, name: true } },
        garment: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        store: { select: { id: true, storeName: true } },
      },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    })
    return NextResponse.json({ success: true, data })
  } catch (e) {
    console.error("[laundry-pricing] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const b = await request.json()
    if (!b.businessId) return NextResponse.json({ error: "businessId is required" }, { status: 400 })
    const biz = await resolveLaundryBusiness(b.businessId)
    if (!biz) return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })
    const data = await prisma.laundryPricingRule.create({
      data: {
        businessId: biz.id,
        serviceId: b.serviceId || null,
        garmentId: b.garmentId || null,
        categoryId: b.categoryId || null,
        storeId: b.storeId || null,
        customerType: b.customerType || null,
        pricingType: b.pricingType || "PER_PIECE",
        price: Number(b.price) || 0,
        gstPercent: Number(b.gstPercent) || 0,
        minCharge: NUM(b.minCharge),
        maxWeightKg: NUM(b.maxWeightKg),
        extraWeightCharge: NUM(b.extraWeightCharge),
        weekendPrice: NUM(b.weekendPrice),
        expressCharge: NUM(b.expressCharge),
        pickupCharge: NUM(b.pickupCharge),
        deliveryCharge: NUM(b.deliveryCharge),
        effectiveFrom: b.effectiveFrom ? new Date(b.effectiveFrom) : null,
        effectiveTo: b.effectiveTo ? new Date(b.effectiveTo) : null,
        priority: Number(b.priority) || 0,
        isActive: b.isActive ?? true,
      },
    })
    return NextResponse.json({ success: true, data })
  } catch (e) {
    console.error("[laundry-pricing] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
