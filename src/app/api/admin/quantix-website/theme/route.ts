import { NextResponse } from "next/server"
import { withMiddleware } from "@/lib/middleware"
import { db } from "@/lib/db"
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
      "logo", "darkLogo", "favicon", "loader",
      "fontFamily", "buttonStyle",
    ]
    const data: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body) data[key] = body[key]
    }

    const theme = await db.websiteTheme.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", ...data },
      update: data,
    })

    return NextResponse.json({ theme })
  }
)
