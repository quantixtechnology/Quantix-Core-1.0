// PUT    /api/laundry/categories/[id]  — update
// DELETE /api/laundry/categories/[id]  — delete
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { name, description, displayOrder, isActive } = await request.json()
    const data = await prisma.laundryCategory.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description: description || null }),
        ...(displayOrder !== undefined && { displayOrder }),
        ...(isActive !== undefined && { isActive: !!isActive }),
      },
    })
    return NextResponse.json({ success: true, data })
  } catch (e) {
    console.error("[laundry-categories] PUT", e)
    return NextResponse.json({ error: "Failed to update category" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await prisma.laundryCategory.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error("[laundry-categories] DELETE", e)
    return NextResponse.json({ error: "Failed to delete category" }, { status: 500 })
  }
}
