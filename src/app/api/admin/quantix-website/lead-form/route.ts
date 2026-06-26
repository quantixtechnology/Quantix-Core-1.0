import { NextResponse } from "next/server"
import { withMiddleware } from "@/lib/middleware"
import { db } from "@/lib/db"
import type { NextRequest } from "next/server"

interface AuthenticatedRequest extends NextRequest {
  user?: { id: string; name: string; email: string; role: string }
}

export const GET = withMiddleware({ requireAuth: true, requiredPermission: "website:view" })(
  async (_req: AuthenticatedRequest) => {
    let leadForm = await db.websiteLeadForm.findUnique({ where: { id: "singleton" } })

    if (!leadForm) {
      leadForm = await db.websiteLeadForm.create({
        data: {
          id: "singleton",
          isEnabled: true,
          autoReplyEnabled: true,
          successMessage: "Thank you! We'll get back to you soon.",
          failureMessage: "Something went wrong. Please try again.",
        },
      })
    }

    return NextResponse.json({ leadForm })
  }
)

export const PATCH = withMiddleware({ requireAuth: true, requiredPermission: "website:configure" })(
  async (req: AuthenticatedRequest) => {
    const body = await req.json()

    const allowed = [
      "isEnabled", "recipientEmail", "autoReplyEnabled", "autoReplyMessage",
      "successMessage", "failureMessage", "redirectUrl",
    ]
    const data: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body) data[key] = body[key]
    }

    const leadForm = await db.websiteLeadForm.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", ...data },
      update: data,
    })

    return NextResponse.json({ leadForm })
  }
)
