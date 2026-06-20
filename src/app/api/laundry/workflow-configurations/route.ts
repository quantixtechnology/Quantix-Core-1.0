import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get("businessId")

    const where: Record<string, unknown> = {}
    if (businessId) where.businessId = businessId

    const configs = await prisma.laundryWorkflowConfiguration.findMany({
      where,
      include: { stage: true },
      orderBy: { createdAt: "asc" },
    })

    return NextResponse.json(configs)
  } catch (error) {
    console.error("Error fetching workflow configurations:", error)
    return NextResponse.json({ error: "Failed to fetch workflow configurations" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { businessId, stageId, enabled, sequence } = body

    if (!businessId || !stageId) {
      return NextResponse.json({ error: "Business ID and Stage ID are required" }, { status: 400 })
    }

    const config = await prisma.laundryWorkflowConfiguration.create({
      data: {
        businessId,
        stageId,
        enabled: enabled ?? true,
        sequence: sequence ?? null,
      },
      include: { stage: true },
    })

    return NextResponse.json(config, { status: 201 })
  } catch (error) {
    console.error("Error creating workflow configuration:", error)
    return NextResponse.json({ error: "Failed to create workflow configuration" }, { status: 500 })
  }
}
