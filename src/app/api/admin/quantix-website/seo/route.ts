import { NextResponse } from "next/server"
import { withMiddleware } from "@/lib/middleware"
import { db } from "@/lib/db"
import type { NextRequest } from "next/server"

interface AuthenticatedRequest extends NextRequest {
  user?: { id: string; name: string; email: string; role: string }
}

export const GET = withMiddleware({ requireAuth: true, requiredPermission: "website:view" })(
  async (_req: AuthenticatedRequest) => {
    let seo = await db.websiteSEO.findUnique({ where: { id: "singleton" } })

    if (!seo) {
      seo = await db.websiteSEO.create({
        data: {
          id: "singleton",
          robotsTxt: "index, follow",
        },
      })
    }

    return NextResponse.json({ seo })
  }
)

export const PATCH = withMiddleware({ requireAuth: true, requiredPermission: "website:configure" })(
  async (req: AuthenticatedRequest) => {
    const body = await req.json()

    const allowed = [
      "homepageMetaTitle", "homepageMetaDesc", "homepageKeywords",
      "openGraphImage", "twitterImage", "canonicalUrl", "robotsTxt",
      "googleAnalyticsId", "googleTagManagerId", "facebookPixelId",
    ]
    const data: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body) data[key] = body[key]
    }

    const seo = await db.websiteSEO.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", ...data },
      update: data,
    })

    return NextResponse.json({ seo })
  }
)
