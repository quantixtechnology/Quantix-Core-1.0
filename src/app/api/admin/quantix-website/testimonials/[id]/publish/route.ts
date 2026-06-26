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

    const testimonial = await db.websiteTestimonial.update({
      where: { id },
      data: {
        publishStatus: "PUBLISHED",
        publishedAt: new Date(),
        publishedBy: req.user?.id,
      },
    })

    // Log audit
    await logWebsiteAudit({
      userId: req.user?.id,
      userName: req.user?.name,
      email: req.user?.email,
      role: req.user?.role,
      action: "PUBLISH",
      resourceType: "WebsiteTestimonial",
      resourceId: id,
      description: `Published testimonial from ${testimonial.customerName} to production`,
      newValues: JSON.parse(JSON.stringify(testimonial)),
    })

    return NextResponse.json({ testimonial })
  }
)
