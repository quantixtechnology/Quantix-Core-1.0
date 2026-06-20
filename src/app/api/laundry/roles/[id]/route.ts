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
    const { code, name, description, isActive } = body

    const existing = await prisma.laundryRole.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Laundry role not found" }, { status: 404 })
    }

    const role = await prisma.laundryRole.update({
      where: { id },
      data: {
        ...(code !== undefined && { code }),
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(isActive !== undefined && { isActive }),
      },
    })

    return NextResponse.json(role)
  } catch (error) {
    console.error("Error updating laundry role:", error)
    return NextResponse.json({ error: "Failed to update laundry role" }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const existing = await prisma.laundryRole.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Laundry role not found" }, { status: 404 })
    }

    await prisma.laundryRole.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting laundry role:", error)
    return NextResponse.json({ error: "Failed to delete laundry role" }, { status: 500 })
  }
}
