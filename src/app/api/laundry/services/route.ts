// GET  /api/laundry/services?businessId=  — list services (with category)
// POST /api/laundry/services               — create service
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const businessId = new URL(request.url).searchParams.get("businessId")
    if (!businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ success: true, data: [] })
    const data = await prisma.laundryService.findMany({
      where: { businessId: biz.id },
      include: { category: { select: { id: true, name: true } } },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    })
    return NextResponse.json({ success: true, data })
  } catch (e) {
    console.error("[laundry-services] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const b = await request.json()
    if (!b.businessId || !b.name?.trim()) return NextResponse.json({ error: "businessId and name are required" }, { status: 400 })
    const biz = await resolveLaundryBusiness(b.businessId)
    if (!biz) return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })
    const NUM = (v: unknown) => (v === "" || v === null || v === undefined ? null : Number(v))
    const data = await prisma.laundryService.create({
      data: {
        businessId: biz.id,
        name: b.name.trim(),
        code: b.code?.trim() || null,
        categoryId: b.categoryId || null,
        description: b.description?.trim() || null,
        icon: b.icon?.trim() || null,
        image: b.image?.trim() || null,
        color: b.color?.trim() || null,
        defaultPricingType: b.defaultPricingType || "PER_PIECE",
        defaultGstPercent: NUM(b.defaultGstPercent),
        defaultTurnaroundHours: typeof b.defaultTurnaroundHours === "number" ? b.defaultTurnaroundHours : 24,
        processingSequence: typeof b.processingSequence === "number" ? b.processingSequence : 0,
        expressAvailable: b.expressAvailable ?? false,
        displayOnWebsite: b.displayOnWebsite ?? true,
        availableInStore: b.availableInStore ?? true,
        availableForPickup: b.availableForPickup ?? true,
        subscriptionEligible: b.subscriptionEligible ?? false,
        displayOrder: typeof b.displayOrder === "number" ? b.displayOrder : 0,
        isActive: b.isActive ?? true,
      },
    })
    return NextResponse.json({ success: true, data })
  } catch (e) {
    console.error("[laundry-services] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
