import { NextResponse } from "next/server"
import { withMiddleware } from "@/lib/middleware"
import { db } from "@/lib/db"
import { logWebsiteAudit } from "@/lib/website-audit"
import type { NextRequest } from "next/server"

interface AuthenticatedRequest extends NextRequest {
  user?: { id: string; name: string; email: string; role: string }
}

export const POST = withMiddleware({ requireAuth: true, requiredPermission: "website:configure" })(
  async (req: AuthenticatedRequest) => {
    const theme = await db.websiteTheme.update({
      where: { id: "singleton" },
      data: {
        publishStatus: "PUBLISHED",
        publishedAt: new Date(),
        publishedBy: req.user?.id,
      },
    })

    // Log audit
    await logWebsiteAudit({
      userId: req.user?.id,
      userName: req.user?.name,
      email: req.user?.email,
      role: req.user?.role,
      action: "PUBLISH",
      resourceType: "WebsiteTheme",
      resourceId: "singleton",
      description: "Published website theme to production",
      newValues: JSON.parse(JSON.stringify(theme)),
    })

    return NextResponse.json({ theme })
  }
)
