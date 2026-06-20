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
    const { code, name, enabled, sequence, storeId } = body

    const existing = await prisma.laundryDepartment.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Department not found" }, { status: 404 })
    }

    const department = await prisma.laundryDepartment.update({
      where: { id },
      data: {
        ...(code !== undefined && { code }),
        ...(name !== undefined && { name }),
        ...(enabled !== undefined && { enabled }),
        ...(sequence !== undefined && { sequence }),
        ...(storeId !== undefined && { storeId: storeId || null }),
      },
    })

    return NextResponse.json(department)
  } catch (error) {
    console.error("Error updating department:", error)
    return NextResponse.json({ error: "Failed to update department" }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const existing = await prisma.laundryDepartment.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Department not found" }, { status: 404 })
    }

    await prisma.laundryDepartment.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting department:", error)
    return NextResponse.json({ error: "Failed to delete department" }, { status: 500 })
  }
}
