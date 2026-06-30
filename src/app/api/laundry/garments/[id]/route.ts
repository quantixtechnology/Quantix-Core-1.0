// PUT    /api/laundry/garments/[id]  — update
// DELETE /api/laundry/garments/[id]  — delete
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { name, categoryId, defaultService, defaultUnit, displayOrder, isActive } = await request.json()
    const data = await prisma.laundryGarment.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(categoryId !== undefined && { categoryId: categoryId || null }),
        ...(defaultService !== undefined && { defaultService: defaultService || null }),
        ...(defaultUnit !== undefined && { defaultUnit: defaultUnit === "KG" ? "KG" : "PIECE" }),
        ...(displayOrder !== undefined && { displayOrder }),
        ...(isActive !== undefined && { isActive: !!isActive }),
      },
    })
    return NextResponse.json({ success: true, data })
  } catch (e) {
    console.error("[laundry-garments] PUT", e)
    return NextResponse.json({ error: "Failed to update garment" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await prisma.laundryGarment.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error("[laundry-garments] DELETE", e)
    return NextResponse.json({ error: "Failed to delete garment" }, { status: 500 })
  }
}
