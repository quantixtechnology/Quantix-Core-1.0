import { NextResponse } from "next/server"
import { withMiddleware } from "@/lib/middleware"
import { db } from "@/lib/db"
import type { NextRequest } from "next/server"

interface AuthenticatedRequest extends NextRequest {
  user?: { id: string; name: string; email: string; role: string }
}

type Ctx = { params?: Promise<Record<string, string | string[]>> }

export const POST = withMiddleware({ requireAuth: true, requiredPermission: "website:edit" })(
  async (req: AuthenticatedRequest, ctx?: Ctx) => {
    const params = await ctx?.params
    const id = params?.id as string | undefined
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

    const { featureName } = await req.json()

    if (!featureName?.trim()) {
      return NextResponse.json({ error: "featureName is required" }, { status: 400 })
    }

    const last = await db.websitePlanFeature.findFirst({
      where: { planId: id },
      orderBy: { displayOrder: "desc" },
    })
    const displayOrder = (last?.displayOrder ?? 0) + 1

    const feature = await db.websitePlanFeature.create({
      data: { planId: id, featureName: featureName.trim(), displayOrder },
    })

    return NextResponse.json({ feature }, { status: 201 })
  }
)
