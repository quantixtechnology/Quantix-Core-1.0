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
    const id = params?.id as string | undefined
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

    const body = await req.json()

    const allowed = [
      "planName", "billingType", "price", "priceDisplay",
      "implementationFee", "description", "discountMessage",
      "displayOrder", "isActive",
    ]
    const data: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body) data[key] = body[key]
    }

    const plan = await db.websitePricingPlan.update({
      where: { id },
      data,
      include: { features: { orderBy: { displayOrder: "asc" } } },
    })

    return NextResponse.json({ plan })
  }
)
