import { NextResponse } from "next/server"
import { withMiddleware } from "@/lib/api-middleware"
import { prisma } from "@/lib/prisma"

export const PATCH = withMiddleware({ requireAuth: true, requiredPermission: "website:edit" })(
  async (req, { params }: { params: Promise<{ id: string; featureId: string }> }) => {
    const { featureId } = await params
    const body = await req.json()

    const data: Record<string, unknown> = {}
    if ("featureName" in body) data.featureName = body.featureName
    if ("displayOrder" in body) data.displayOrder = body.displayOrder

    const feature = await prisma.websitePlanFeature.update({
      where: { id: featureId },
      data,
    })

    return NextResponse.json({ feature })
  }
)

export const DELETE = withMiddleware({ requireAuth: true, requiredPermission: "website:edit" })(
  async (_req, { params }: { params: Promise<{ id: string; featureId: string }> }) => {
    const { featureId } = await params

    await prisma.websitePlanFeature.delete({ where: { id: featureId } })

    return NextResponse.json({ success: true })
  }
)
