import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireLaundryMember } from "@/lib/laundry-rbac"

export const runtime = "nodejs"

export async function GET() {
  try {
    const stages = await prisma.laundryWorkflowStage.findMany({
      orderBy: { sequence: "asc" },
    })
    return NextResponse.json(stages)
  } catch (error) {
    console.error("Error fetching workflow stages:", error)
    return NextResponse.json({ error: "Failed to fetch workflow stages" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { code, name, sequence, description, isDefault, isActive } = body

    if (!code || !name || sequence === undefined) {
      return NextResponse.json({ error: "Code, name, and sequence are required" }, { status: 400 })
    }

    const stage = await prisma.laundryWorkflowStage.create({
      data: {
        code,
        name,
        sequence,
        description: description || null,
        isDefault: isDefault ?? false,
        isActive: isActive ?? true,
        isSystem: false,
      },
    })

    return NextResponse.json(stage, { status: 201 })
  } catch (error) {
    console.error("Error creating workflow stage:", error)
    return NextResponse.json({ error: "Failed to create workflow stage" }, { status: 500 })
  }
}
