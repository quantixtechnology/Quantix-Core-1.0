import { NextResponse } from "next/server"
import { withMiddleware } from "@/lib/middleware"
import { db } from "@/lib/db"
import type { NextRequest } from "next/server"

interface AuthenticatedRequest extends NextRequest {
  user?: { id: string; name: string; email: string; role: string }
}

export const GET = withMiddleware({ requireAuth: true, requiredPermission: "website:view" })(
  async (_req: AuthenticatedRequest) => {
    const features = await db.websiteFeature.findMany({
      orderBy: { displayOrder: "asc" },
    })

    return NextResponse.json({ features })
  }
)

export const POST = withMiddleware({ requireAuth: true, requiredPermission: "website:configure" })(
  async (req: AuthenticatedRequest) => {
    const body = await req.json()

    // Get max displayOrder
    const maxOrder = await db.websiteFeature.findFirst({
      orderBy: { displayOrder: "desc" },
      select: { displayOrder: true },
    })

    const feature = await db.websiteFeature.create({
      data: {
        title: body.title || "New Feature",
        subtitle: body.subtitle || null,
        description: body.description || null,
        icon: body.icon || null,
        displayOrder: (maxOrder?.displayOrder ?? 0) + 1,
        isVisible: body.isVisible ?? true,
      },
    })

    return NextResponse.json({ feature }, { status: 201 })
  }
)
