// GET  /api/laundry/garments?businessId=  — list garments (with category)
// POST /api/laundry/garments               — create garment
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const sp = new URL(request.url).searchParams
    const businessId = sp.get("businessId")
    if (!businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ success: true, data: [] })
    // Active-only by default so deactivated ("deleted") garments never surface in
    // New Order, Add Garment or the Customer App. Management screens pass
    // includeInactive=1 to see/reactivate them.
    const includeInactive = sp.get("includeInactive") === "1"
    const data = await prisma.laundryGarment.findMany({
      where: { businessId: biz.id, ...(includeInactive ? {} : { isActive: true }) },
      include: { category: { select: { id: true, name: true } } },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    })
    return NextResponse.json({ success: true, data })
  } catch (e) {
    console.error("[laundry-garments] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { businessId, name, code, categoryId, defaultService, defaultUnit, image, material, careInstructions, barcodePrefix, weightFactor, averageWeight, subscriptionIncluded, displayOrder, isActive } = body
    if (!businessId || !name?.trim()) return NextResponse.json({ error: "businessId and name are required" }, { status: 400 })
    const guard = await requireLaundryPermission(request, businessId, "laundry.pricing.edit_pricing")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })
    const NUM = (v: unknown) => (v === "" || v === null || v === undefined ? null : Number(v))
    const data = await prisma.laundryGarment.create({
      data: {
        businessId: biz.id,
        name: name.trim(),
        code: code?.trim() || null,
        categoryId: categoryId || null,
        defaultService: defaultService || null,
        defaultUnit: defaultUnit === "KG" ? "KG" : "PIECE",
        image: image?.trim() || null,
        material: material?.trim() || null,
        careInstructions: careInstructions?.trim() || null,
        barcodePrefix: barcodePrefix?.trim() || null,
        weightFactor: NUM(weightFactor),
        averageWeight: NUM(averageWeight),
        subscriptionIncluded: !!subscriptionIncluded,
        displayOrder: typeof displayOrder === "number" ? displayOrder : 0,
        isActive: isActive !== undefined ? !!isActive : true,
      },
    })
    return NextResponse.json({ success: true, data })
  } catch (e) {
    console.error("[laundry-garments] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
