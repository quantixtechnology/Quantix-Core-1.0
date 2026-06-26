import { NextResponse } from "next/server"
import { withMiddleware } from "@/lib/middleware"
import { db } from "@/lib/db"
import type { NextRequest } from "next/server"

interface AuthenticatedRequest extends NextRequest {
  user?: { id: string; name: string; email: string; role: string }
}

export const GET = withMiddleware({ requireAuth: true, requiredPermission: "website:view" })(
  async (_req: AuthenticatedRequest) => {
    let general = await db.websiteGeneral.findUnique({ where: { id: "singleton" } })

    if (!general) {
      general = await db.websiteGeneral.create({
        data: {
          id: "singleton",
          websiteName: "Quantix",
          defaultLanguage: "en-IN",
          timezone: "Asia/Kolkata",
        },
      })
    }

    return NextResponse.json({ general })
  }
)

export const PATCH = withMiddleware({ requireAuth: true, requiredPermission: "website:configure" })(
  async (req: AuthenticatedRequest) => {
    const body = await req.json()

    const allowed = [
      "websiteName", "websiteUrl", "defaultLanguage", "timezone",
      "companyEmail", "supportEmail", "salesPhone", "supportPhone",
      "copyright", "websiteStatus", "maintenanceMode", "maintenanceMessage",
    ]
    const data: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body) data[key] = body[key]
    }

    const general = await db.websiteGeneral.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", ...data },
      update: data,
    })

    return NextResponse.json({ general })
  }
)
