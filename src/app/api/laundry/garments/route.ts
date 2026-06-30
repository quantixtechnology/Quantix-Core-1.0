// GET  /api/laundry/garments?businessId=  — list garments (with category)
// POST /api/laundry/garments               — create garment
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
    const data = await prisma.laundryGarment.findMany({
      where: { businessId: biz.id },
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
    const { businessId, name, categoryId, defaultService, defaultUnit, displayOrder, isActive } = body
    if (!businessId || !name?.trim()) return NextResponse.json({ error: "businessId and name are required" }, { status: 400 })
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })
    const data = await prisma.laundryGarment.create({
      data: {
        businessId: biz.id,
        name: name.trim(),
        categoryId: categoryId || null,
        defaultService: defaultService || null,
        defaultUnit: defaultUnit === "KG" ? "KG" : "PIECE",
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
