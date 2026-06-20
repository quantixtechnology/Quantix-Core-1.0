import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const stageId = searchParams.get("stageId")
    const roleId = searchParams.get("roleId")

    const where: Record<string, unknown> = {}
    if (stageId) where.stageId = stageId
    if (roleId) where.roleId = roleId

    const permissions = await prisma.laundryStagePermission.findMany({
      where,
      include: {
        stage: true,
        role: true,
      },
      orderBy: { createdAt: "asc" },
    })

    return NextResponse.json(permissions)
  } catch (error) {
    console.error("Error fetching stage permissions:", error)
    return NextResponse.json({ error: "Failed to fetch stage permissions" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { stageId, roleId } = body

    if (!stageId || !roleId) {
      return NextResponse.json({ error: "Stage ID and Role ID are required" }, { status: 400 })
    }

    const permission = await prisma.laundryStagePermission.create({
      data: { stageId, roleId },
      include: { stage: true, role: true },
    })

    return NextResponse.json(permission, { status: 201 })
  } catch (error) {
    console.error("Error creating stage permission:", error)
    return NextResponse.json({ error: "Failed to create stage permission" }, { status: 500 })
  }
}
