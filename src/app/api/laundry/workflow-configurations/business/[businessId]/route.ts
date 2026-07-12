import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireLaundryPermission } from "@/lib/laundry-rbac"

export const runtime = "nodejs"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params
    const guard = await requireLaundryPermission(request, businessId, "laundry.settings.view")
    if (!guard.ok) return guard.res

    const configs = await prisma.laundryWorkflowConfiguration.findMany({
      where: { businessId },
      include: {
        stage: true,
        responsibleRole: { select: { id: true, code: true, name: true, isSystem: true } },
        responsibleDepartment: { select: { id: true, code: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    })

    const stages = await prisma.laundryWorkflowStage.findMany({
      orderBy: { sequence: "asc" },
    })

    const stageMap = new Map(configs.map((c) => [c.stageId, c]))

    const result = stages.map((stage) => {
      const config = stageMap.get(stage.id)
      return {
        stage,
        configuration: config || null,
        enabled: config ? config.enabled : false,
      }
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error fetching business workflow config:", error)
    return NextResponse.json({ error: "Failed to fetch business workflow configuration" }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params
    const guard = await requireLaundryPermission(request, businessId, "laundry.settings.edit")
    if (!guard.ok) return guard.res
    const body = await request.json()
    const { stageId, enabled, sequence, responsibleRoleId, responsibleDepartmentId, canView, canUpdate, canApprove } = body

    if (!stageId) {
      return NextResponse.json({ error: "Stage ID is required" }, { status: 400 })
    }

    const updateData: Record<string, unknown> = {}
    if (enabled !== undefined) updateData.enabled = enabled
    if (sequence !== undefined) updateData.sequence = sequence
    if (responsibleRoleId !== undefined) updateData.responsibleRoleId = responsibleRoleId || null
    if (responsibleDepartmentId !== undefined) updateData.responsibleDepartmentId = responsibleDepartmentId || null
    if (canView !== undefined) updateData.canView = canView
    if (canUpdate !== undefined) updateData.canUpdate = canUpdate
    if (canApprove !== undefined) updateData.canApprove = canApprove

    const config = await prisma.laundryWorkflowConfiguration.upsert({
      where: {
        businessId_stageId: { businessId, stageId },
      },
      update: updateData,
      create: {
        businessId,
        stageId,
        enabled: enabled ?? true,
        sequence: sequence ?? null,
        responsibleRoleId: responsibleRoleId || null,
        responsibleDepartmentId: responsibleDepartmentId || null,
        canView: canView ?? true,
        canUpdate: canUpdate ?? false,
        canApprove: canApprove ?? false,
      },
      include: {
        stage: true,
        responsibleRole: { select: { id: true, code: true, name: true, isSystem: true } },
        responsibleDepartment: { select: { id: true, code: true, name: true } },
      },
    })

    return NextResponse.json(config, { status: 201 })
  } catch (error) {
    console.error("Error upserting workflow configuration:", error)
    return NextResponse.json({ error: "Failed to upsert workflow configuration" }, { status: 500 })
  }
}
