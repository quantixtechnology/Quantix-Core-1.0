import { NextResponse } from "next/server"
import { withMiddleware } from "@/lib/middleware"
import { db } from "@/lib/db"
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

    // Get max displayOrder
    const maxOrder = await db.websiteNavigation.findFirst({
      orderBy: { displayOrder: "desc" },
      select: { displayOrder: true },
    })

    const item = await db.websiteNavigation.create({
      data: {
        menuName: body.menuName || "Menu Item",
        url: body.url || "#",
        displayOrder: (maxOrder?.displayOrder ?? 0) + 1,
        openInNewTab: body.openInNewTab ?? false,
        isVisible: body.isVisible ?? true,
      },
    })

    return NextResponse.json({ item }, { status: 201 })
  }
)
