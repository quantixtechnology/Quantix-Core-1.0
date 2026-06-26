import { NextResponse } from "next/server"
import { withMiddleware } from "@/lib/middleware"
import { db } from "@/lib/db"
import type { NextRequest } from "next/server"

interface AuthenticatedRequest extends NextRequest {
  user?: { id: string; name: string; email: string; role: string }
}

export const GET = withMiddleware({ requireAuth: true, requiredPermission: "website:view" })(
  async (_req: AuthenticatedRequest) => {
    const states = await db.websitePublishState.findMany()

    return NextResponse.json({ states })
  }
)

export const POST = withMiddleware({ requireAuth: true, requiredPermission: "website:configure" })(
  async (req: AuthenticatedRequest) => {
    const body = await req.json()
    const { sectionKey, status } = body

    if (!sectionKey) {
      return NextResponse.json({ error: "Missing sectionKey" }, { status: 400 })
    }

    if (!["DRAFT", "PUBLISHED"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }

    const state = await db.websitePublishState.upsert({
      where: { sectionKey },
      create: {
        sectionKey,
        status,
        publishedAt: status === "PUBLISHED" ? new Date() : null,
        publishedBy: status === "PUBLISHED" ? (req.user?.id || "unknown") : null,
      },
      update: {
        status,
        publishedAt: status === "PUBLISHED" ? new Date() : null,
        publishedBy: status === "PUBLISHED" ? (req.user?.id || "unknown") : null,
      },
    })

    return NextResponse.json({ state })
  }
)
