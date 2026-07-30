import { NextResponse } from "next/server"
import { withMiddleware } from "@/lib/middleware"
import { db } from "@/lib/db"
import { validateWebsiteNavigation } from "@/lib/website-validation"
import { logWebsiteAudit } from "@/lib/website-audit"
import type { NextRequest } from "next/server"

interface AuthenticatedRequest extends NextRequest {
  user?: { id: string; name: string; email: string; role: string }
}

export const GET = withMiddleware({ requireAuth: true, requiredPermission: "website:view" })(
  async (_req: AuthenticatedRequest) => {
    const items = await db.websiteNavigation.findMany({
      orderBy: { displayOrder: "asc" },
    })

    return NextResponse.json({ items })
  }
)

export const POST = withMiddleware({ requireAuth: true, requiredPermission: "website:configure" })(
  async (req: AuthenticatedRequest) => {
    const body = await req.json()

    const data = {
      menuName: body.menuName,
      url: body.url,
      target: body.target || "_self",
      isExternal: body.isExternal ?? false,
      openInNewTab: body.openInNewTab ?? false,
      isVisible: body.isVisible ?? true,
      parentMenuId: body.parentMenuId || null,
    }

    // Validate input
    const validation = validateWebsiteNavigation(data)
    if (!validation.valid) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.errors },
        { status: 400 }
      )
    }

    // Get max displayOrder
    const maxOrder = await db.websiteNavigation.findFirst({
      orderBy: { displayOrder: "desc" },
      select: { displayOrder: true },
    })

    const item = await db.websiteNavigation.create({
      data: {
        ...data,
        displayOrder: (maxOrder?.displayOrder ?? 0) + 1,
      },
    })

    // Log audit
    await logWebsiteAudit({
      userId: req.user?.id,
      userName: req.user?.name,
      email: req.user?.email,
      role: req.user?.role,
      action: "CREATE",
      resourceType: "WebsiteNavigation",
      resourceId: item.id,
      description: `Created navigation menu item: ${item.menuName}`,
      newValues: JSON.parse(JSON.stringify(item)),
    })

    return NextResponse.json({ item }, { status: 201 })
  }
)
