import { NextResponse } from "next/server"
import { withMiddleware } from "@/lib/middleware"
import { db } from "@/lib/db"
import type { NextRequest } from "next/server"

interface AuthenticatedRequest extends NextRequest {
  user?: { id: string; name: string; email: string; role: string }
}

type Ctx = { params?: Promise<Record<string, string | string[]>> }

export const PATCH = withMiddleware({ requireAuth: true, requiredPermission: "website:edit" })(
  async (req: AuthenticatedRequest, ctx?: Ctx) => {
    const params = await ctx?.params
    const featureId = params?.featureId as string | undefined
    if (!featureId) return NextResponse.json({ error: "Missing featureId" }, { status: 400 })

    const body = await req.json()

    const data: Record<string, unknown> = {}
    if ("featureName" in body) data.featureName = body.featureName
    if ("displayOrder" in body) data.displayOrder = body.displayOrder

    const feature = await db.websitePlanFeature.update({
      where: { id: featureId },
      data,
    })

    return NextResponse.json({ feature })
  }
)

export const DELETE = withMiddleware({ requireAuth: true, requiredPermission: "website:edit" })(
  async (_req: AuthenticatedRequest, ctx?: Ctx) => {
    const params = await ctx?.params
    const featureId = params?.featureId as string | undefined
    if (!featureId) return NextResponse.json({ error: "Missing featureId" }, { status: 400 })

    await db.websitePlanFeature.delete({ where: { id: featureId } })

    return NextResponse.json({ success: true })
  }
)
