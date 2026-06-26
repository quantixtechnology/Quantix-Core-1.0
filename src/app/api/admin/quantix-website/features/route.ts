import { NextResponse } from "next/server"
import { withMiddleware } from "@/lib/middleware"
import { db } from "@/lib/db"
import { validateWebsiteFeature } from "@/lib/website-validation"
import { logWebsiteAudit } from "@/lib/website-audit"
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

    // Validate input
    const validation = validateWebsiteFeature(body)
    if (!validation.valid) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.errors },
        { status: 400 }
      )
    }

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

    // Log audit
    await logWebsiteAudit({
      userId: req.user?.id,
      userName: req.user?.name,
      email: req.user?.email,
      role: req.user?.role,
      action: "CREATE",
      resourceType: "WebsiteFeature",
      resourceId: feature.id,
      description: `Created feature: ${feature.title}`,
      newValues: JSON.parse(JSON.stringify(feature)),
    })

    return NextResponse.json({ feature }, { status: 201 })
  }
)
