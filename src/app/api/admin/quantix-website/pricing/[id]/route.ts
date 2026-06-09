import { NextResponse } from "next/server"
import { withMiddleware } from "@/lib/api-middleware"
import { prisma } from "@/lib/prisma"

export const PATCH = withMiddleware({ requireAuth: true, requiredPermission: "website:edit" })(
  async (req, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params
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

    const plan = await prisma.websitePricingPlan.update({
      where: { id },
      data,
      include: { features: { orderBy: { displayOrder: "asc" } } },
    })

    return NextResponse.json({ plan })
  }
)
