import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { storeId, departmentId, roleId, userId, active } = body

    const existing = await prisma.laundryUserAssignment.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 })
    }

    const assignment = await prisma.laundryUserAssignment.update({
      where: { id },
      data: {
        ...(storeId !== undefined && { storeId: storeId || null }),
        ...(departmentId !== undefined && { departmentId: departmentId || null }),
        ...(roleId !== undefined && { roleId }),
        ...(userId !== undefined && { userId: userId || null }),
        ...(active !== undefined && { active }),
      },
      include: {
        store: { select: { id: true, storeName: true, storeCode: true } },
        department: { select: { id: true, name: true, code: true } },
        role: { select: { id: true, name: true, code: true, isSystem: true } },
      },
    })

    return NextResponse.json(assignment)
  } catch (error) {
    console.error("Error updating assignment:", error)
    return NextResponse.json({ error: "Failed to update assignment" }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const existing = await prisma.laundryUserAssignment.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 })
    }

    await prisma.laundryUserAssignment.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting assignment:", error)
    return NextResponse.json({ error: "Failed to delete assignment" }, { status: 500 })
  }
}
