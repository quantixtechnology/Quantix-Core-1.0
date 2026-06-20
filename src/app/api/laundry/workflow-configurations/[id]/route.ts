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
    const { enabled, sequence, responsibleRoleId, responsibleDepartmentId, canView, canUpdate, canApprove } = body

    const existing = await prisma.laundryWorkflowConfiguration.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Workflow configuration not found" }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (enabled !== undefined) updateData.enabled = enabled
    if (sequence !== undefined) updateData.sequence = sequence
    if (responsibleRoleId !== undefined) updateData.responsibleRoleId = responsibleRoleId || null
    if (responsibleDepartmentId !== undefined) updateData.responsibleDepartmentId = responsibleDepartmentId || null
    if (canView !== undefined) updateData.canView = canView
    if (canUpdate !== undefined) updateData.canUpdate = canUpdate
    if (canApprove !== undefined) updateData.canApprove = canApprove

    const config = await prisma.laundryWorkflowConfiguration.update({
      where: { id },
      data: updateData,
      include: {
        stage: true,
        responsibleRole: { select: { id: true, code: true, name: true, isSystem: true } },
        responsibleDepartment: { select: { id: true, code: true, name: true } },
      },
    })

    return NextResponse.json(config)
  } catch (error) {
    console.error("Error updating workflow configuration:", error)
    return NextResponse.json({ error: "Failed to update workflow configuration" }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const existing = await prisma.laundryWorkflowConfiguration.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Workflow configuration not found" }, { status: 404 })
    }

    await prisma.laundryWorkflowConfiguration.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting workflow configuration:", error)
    return NextResponse.json({ error: "Failed to delete workflow configuration" }, { status: 500 })
  }
}
