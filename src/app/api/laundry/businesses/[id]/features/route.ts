import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const features = await prisma.laundryBusinessFeature.findMany({
      where: { businessId: id },
    })
    return NextResponse.json(features)
  } catch (error) {
    console.error("Error fetching laundry features:", error)
    return NextResponse.json({ error: "Failed to fetch features" }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { features } = body as { features: { featureKey: string; enabled: boolean }[] }

    if (!Array.isArray(features)) {
      return NextResponse.json({ error: "features array is required" }, { status: 400 })
    }

    const result = await prisma.$transaction(
      features.map((f) =>
        prisma.laundryBusinessFeature.upsert({
          where: { businessId_featureKey: { businessId: id, featureKey: f.featureKey } },
          update: { enabled: f.enabled },
          create: { businessId: id, featureKey: f.featureKey, enabled: f.enabled },
        })
      )
    )

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error updating laundry features:", error)
    return NextResponse.json({ error: "Failed to update features" }, { status: 500 })
  }
}
