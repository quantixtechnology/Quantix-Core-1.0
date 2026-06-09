import { NextResponse } from "next/server"
import { withMiddleware } from "@/lib/api-middleware"
import { prisma } from "@/lib/prisma"

export const POST = withMiddleware({ requireAuth: true, requiredPermission: "website:edit" })(
  async (req, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params
    const { featureName } = await req.json()

    if (!featureName?.trim()) {
      return NextResponse.json({ error: "featureName is required" }, { status: 400 })
    }

    const last = await prisma.websitePlanFeature.findFirst({
      where: { planId: id },
      orderBy: { displayOrder: "desc" },
    })
    const displayOrder = (last?.displayOrder ?? 0) + 1

    const feature = await prisma.websitePlanFeature.create({
      data: { planId: id, featureName: featureName.trim(), displayOrder },
    })

    return NextResponse.json({ feature }, { status: 201 })
  }
)
