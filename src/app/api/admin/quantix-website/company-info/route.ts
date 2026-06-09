import { NextResponse } from "next/server"
import { withMiddleware } from "@/lib/middleware"
import { db } from "@/lib/db"
import type { NextRequest } from "next/server"

interface AuthenticatedRequest extends NextRequest {
  user?: { id: string; name: string; email: string; role: string }
}

export const GET = withMiddleware({ requireAuth: true, requiredPermission: "website:view" })(
  async (_req: AuthenticatedRequest) => {
    let info = await db.websiteCompanyInfo.findUnique({ where: { id: "singleton" } })

    if (!info) {
      info = await db.websiteCompanyInfo.create({
        data: {
          id: "singleton",
          companyName: "Quantix Technology",
          websiteUrl: "https://quantixtechnology.in",
        },
      })
    }

    return NextResponse.json({ info })
  }
)

export const PATCH = withMiddleware({ requireAuth: true, requiredPermission: "website:configure" })(
  async (req: AuthenticatedRequest) => {
    const body = await req.json()

    const allowed = [
      "companyName", "address", "contactNumber", "whatsappNumber",
      "supportEmail", "salesEmail", "websiteUrl",
      "gstNumber", "shopActNumber", "msmeNumber",
    ]
    const data: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body) data[key] = body[key]
    }

    const info = await db.websiteCompanyInfo.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", ...data },
      update: data,
    })

    return NextResponse.json({ info })
  }
)
