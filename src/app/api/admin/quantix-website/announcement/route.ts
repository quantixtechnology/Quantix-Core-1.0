import { NextResponse } from "next/server"
import { withMiddleware } from "@/lib/middleware"
import { db } from "@/lib/db"
import type { NextRequest } from "next/server"

interface AuthenticatedRequest extends NextRequest {
  user?: { id: string; name: string; email: string; role: string }
}

export const GET = withMiddleware({ requireAuth: true, requiredPermission: "website:view" })(
  async (_req: AuthenticatedRequest) => {
    let announcement = await db.websiteAnnouncement.findUnique({ where: { id: "singleton" } })

    if (!announcement) {
      announcement = await db.websiteAnnouncement.create({
        data: {
          id: "singleton",
          isEnabled: false,
          backgroundColor: "#FCD34D",
          textColor: "#000000",
        },
      })
    }

    return NextResponse.json({ announcement })
  }
)

export const PATCH = withMiddleware({ requireAuth: true, requiredPermission: "website:configure" })(
  async (req: AuthenticatedRequest) => {
    const body = await req.json()

    const allowed = [
      "isEnabled", "message", "backgroundColor", "textColor",
      "buttonText", "buttonUrl", "expiryDate",
    ]
    const data: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body) data[key] = body[key]
    }

    const announcement = await db.websiteAnnouncement.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", ...data },
      update: data,
    })

    return NextResponse.json({ announcement })
  }
)
