import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params

    const configs = await prisma.laundryWorkflowConfiguration.findMany({
      where: { businessId },
      include: { stage: true },
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
    const body = await request.json()
    const { stageId, enabled, sequence } = body

    if (!stageId) {
      return NextResponse.json({ error: "Stage ID is required" }, { status: 400 })
    }

    const config = await prisma.laundryWorkflowConfiguration.upsert({
      where: {
        businessId_stageId: { businessId, stageId },
      },
      update: {
        enabled: enabled ?? true,
        ...(sequence !== undefined && { sequence }),
      },
      create: {
        businessId,
        stageId,
        enabled: enabled ?? true,
        sequence: sequence ?? null,
      },
      include: { stage: true },
    })

    return NextResponse.json(config, { status: 201 })
  } catch (error) {
    console.error("Error upserting workflow configuration:", error)
    return NextResponse.json({ error: "Failed to upsert workflow configuration" }, { status: 500 })
  }
}
