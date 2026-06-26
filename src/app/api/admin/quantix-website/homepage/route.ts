import { NextResponse } from "next/server"
import { withMiddleware } from "@/lib/middleware"
import { db } from "@/lib/db"
import type { NextRequest } from "next/server"

interface AuthenticatedRequest extends NextRequest {
  user?: { id: string; name: string; email: string; role: string }
}

export const GET = withMiddleware({ requireAuth: true, requiredPermission: "website:view" })(
  async (_req: AuthenticatedRequest) => {
    let homepage = await db.websiteHomepage.findUnique({ where: { id: "singleton" } })

    if (!homepage) {
      homepage = await db.websiteHomepage.create({
        data: {
          id: "singleton",
          heroTitle: "Welcome to Quantix",
          showStatistics: true,
          showTrustedBy: true,
        },
      })
    }

    return NextResponse.json({ homepage })
  }
)

export const PATCH = withMiddleware({ requireAuth: true, requiredPermission: "website:configure" })(
  async (req: AuthenticatedRequest) => {
    const body = await req.json()

    const allowed = [
      "heroTitle", "heroSubtitle", "heroDescription",
      "primaryBtnText", "primaryBtnUrl", "secondaryBtnText", "secondaryBtnUrl",
      "heroImage", "heroIllustration", "showStatistics", "showTrustedBy", "displayOrder",
    ]
    const data: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body) data[key] = body[key]
    }

    const homepage = await db.websiteHomepage.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", ...data },
      update: data,
    })

    return NextResponse.json({ homepage })
  }
)
