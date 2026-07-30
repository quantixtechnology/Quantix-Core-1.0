import { NextResponse } from "next/server"
import { withMiddleware } from "@/lib/middleware"
import { db } from "@/lib/db"
import { validateWebsiteTheme } from "@/lib/website-validation"
import { logWebsiteAudit } from "@/lib/website-audit"
import type { NextRequest } from "next/server"

interface AuthenticatedRequest extends NextRequest {
  user?: { id: string; name: string; email: string; role: string }
}

export const GET = withMiddleware({ requireAuth: true, requiredPermission: "website:view" })(
  async (_req: AuthenticatedRequest) => {
    let theme = await db.websiteTheme.findUnique({ where: { id: "singleton" } })

    if (!theme) {
      theme = await db.websiteTheme.create({
        data: {
          id: "singleton",
          primaryColor: "#10B981",
          secondaryColor: "#6B7280",
          accentColor: "#2563EB",
          fontFamily: "Inter, sans-serif",
          buttonStyle: "rounded",
        },
      })
    }

    return NextResponse.json({ theme })
  }
)

export const PATCH = withMiddleware({ requireAuth: true, requiredPermission: "website:configure" })(
  async (req: AuthenticatedRequest) => {
    const body = await req.json()

    const allowed = [
      "primaryColor", "secondaryColor", "accentColor",
      "darkModePrimary", "darkModeSecondary",
      "logo", "darkLogo", "favicon", "loader",
      "fontFamily", "headingFont", "bodyFont",
      "buttonStyle", "buttonRadius",
    ]
    const data: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body) data[key] = body[key]
    }

    // Validate input
    const validation = validateWebsiteTheme(data)
    if (!validation.valid) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.errors },
        { status: 400 }
      )
    }

    // Get existing data for audit log
    const existing = await db.websiteTheme.findUnique({ where: { id: "singleton" } })

    const theme = await db.websiteTheme.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", ...data },
      update: data,
    })

    // Log audit
    await logWebsiteAudit({
      userId: req.user?.id,
      userName: req.user?.name,
      email: req.user?.email,
      role: req.user?.role,
      action: existing ? "UPDATE" : "CREATE",
      resourceType: "WebsiteTheme",
      resourceId: "singleton",
      description: `${existing ? "Updated" : "Created"} website theme and colors`,
      oldValues: existing ? JSON.parse(JSON.stringify(existing)) : undefined,
      newValues: JSON.parse(JSON.stringify(theme)),
    })

    return NextResponse.json({ theme })
  }
)
