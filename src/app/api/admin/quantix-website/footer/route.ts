import { NextResponse } from "next/server"
import { withMiddleware } from "@/lib/middleware"
import { db } from "@/lib/db"
import type { NextRequest } from "next/server"

interface AuthenticatedRequest extends NextRequest {
  user?: { id: string; name: string; email: string; role: string }
}

export const GET = withMiddleware({ requireAuth: true, requiredPermission: "website:view" })(
  async (_req: AuthenticatedRequest) => {
    let footer = await db.websiteFooter.findUnique({ where: { id: "singleton" } })

    if (!footer) {
      footer = await db.websiteFooter.create({
        data: {
          id: "singleton",
          quickLinks: "[]",
          socialLinks: "{}",
        },
      })
    }

    const footer_data = {
      ...footer,
      quickLinks: JSON.parse(footer.quickLinks || "[]"),
      socialLinks: JSON.parse(footer.socialLinks || "{}"),
    }

    return NextResponse.json({ footer: footer_data })
  }
)

export const PATCH = withMiddleware({ requireAuth: true, requiredPermission: "website:configure" })(
  async (req: AuthenticatedRequest) => {
    const body = await req.json()

    const allowed = [
      "description", "footerLogo", "quickLinks", "socialLinks", "copyright",
    ]
    const data: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body) {
        if ((key === "quickLinks" || key === "socialLinks") && typeof body[key] === "object") {
          data[key] = JSON.stringify(body[key])
        } else {
          data[key] = body[key]
        }
      }
    }

    const footer = await db.websiteFooter.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", ...data },
      update: data,
    })

    const footer_data = {
      ...footer,
      quickLinks: JSON.parse(footer.quickLinks || "[]"),
      socialLinks: JSON.parse(footer.socialLinks || "{}"),
    }

    return NextResponse.json({ footer: footer_data })
  }
)
