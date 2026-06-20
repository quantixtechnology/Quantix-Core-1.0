import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const stage = await prisma.laundryWorkflowStage.findUnique({ where: { id } })
    if (!stage) {
      return NextResponse.json({ error: "Workflow stage not found" }, { status: 404 })
    }
    return NextResponse.json(stage)
  } catch (error) {
    console.error("Error fetching workflow stage:", error)
    return NextResponse.json({ error: "Failed to fetch workflow stage" }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { code, name, sequence, description, isDefault, isActive } = body

    const existing = await prisma.laundryWorkflowStage.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Workflow stage not found" }, { status: 404 })
    }

    if (existing.isSystem && code !== undefined && code !== existing.code) {
      return NextResponse.json({ error: "Cannot change code of a system stage" }, { status: 403 })
    }

    const stage = await prisma.laundryWorkflowStage.update({
      where: { id },
      data: {
        ...(code !== undefined && { code }),
        ...(name !== undefined && { name }),
        ...(sequence !== undefined && { sequence }),
        ...(description !== undefined && { description }),
        ...(isDefault !== undefined && { isDefault }),
        ...(isActive !== undefined && { isActive }),
      },
    })

    return NextResponse.json(stage)
  } catch (error) {
    console.error("Error updating workflow stage:", error)
    return NextResponse.json({ error: "Failed to update workflow stage" }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const existing = await prisma.laundryWorkflowStage.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Workflow stage not found" }, { status: 404 })
    }

    if (existing.isSystem) {
      return NextResponse.json({ error: "Cannot delete a system stage" }, { status: 403 })
    }

    await prisma.laundryWorkflowStage.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting workflow stage:", error)
    return NextResponse.json({ error: "Failed to delete workflow stage" }, { status: 500 })
  }
}
