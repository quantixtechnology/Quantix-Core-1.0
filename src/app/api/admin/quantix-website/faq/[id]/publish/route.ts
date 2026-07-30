import { NextResponse } from "next/server"
import { withMiddleware } from "@/lib/middleware"
import { db } from "@/lib/db"
import { logWebsiteAudit } from "@/lib/website-audit"
import type { NextRequest } from "next/server"

interface AuthenticatedRequest extends NextRequest {
  user?: { id: string; name: string; email: string; role: string }
}

type Ctx = { params?: Promise<Record<string, string | string[]>> }

export const POST = withMiddleware({ requireAuth: true, requiredPermission: "website:configure" })(
  async (req: AuthenticatedRequest, ctx?: Ctx) => {
    const params = await ctx?.params
    const id = params?.id as string | undefined
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

    const item = await db.websiteFAQ.update({
      where: { id },
      data: {},
    })

    // Log audit
    await logWebsiteAudit({
      userId: req.user?.id,
      userName: req.user?.name,
      email: req.user?.email,
      role: req.user?.role,
      action: "PUBLISH",
      resourceType: "WebsiteFAQ",
      resourceId: id,
      description: `Published FAQ to production: ${item.question.substring(0, 50)}`,
      newValues: JSON.parse(JSON.stringify(item)),
    })

    return NextResponse.json({ item })
  }
)
