// GET  /api/laundry/categories?businessId=   — list categories
// POST /api/laundry/categories                — create category
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
    const data = await prisma.laundryCategory.findMany({
      where: { businessId: biz.id },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    })
    return NextResponse.json({ success: true, data })
  } catch (e) {
    console.error("[laundry-categories] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { businessId, name, description, displayOrder, isActive } = body
    if (!businessId || !name?.trim()) return NextResponse.json({ error: "businessId and name are required" }, { status: 400 })
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })
    const data = await prisma.laundryCategory.create({
      data: {
        businessId: biz.id,
        name: name.trim(),
        description: description || null,
        displayOrder: typeof displayOrder === "number" ? displayOrder : 0,
        isActive: isActive !== undefined ? !!isActive : true,
      },
    })
    return NextResponse.json({ success: true, data })
  } catch (e) {
    console.error("[laundry-categories] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
