import { NextResponse } from "next/server"
import { withMiddleware } from "@/lib/middleware"
import { db } from "@/lib/db"
import { validateWebsiteTestimonial } from "@/lib/website-validation"
import { logWebsiteAudit } from "@/lib/website-audit"
import type { NextRequest } from "next/server"

interface AuthenticatedRequest extends NextRequest {
  user?: { id: string; name: string; email: string; role: string }
}

type Ctx = { params?: Promise<Record<string, string | string[]>> }

export const GET = withMiddleware({ requireAuth: true, requiredPermission: "website:view" })(
  async (req: AuthenticatedRequest, ctx?: Ctx) => {
    const params = await ctx?.params
    const id = params?.id as string | undefined
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

    const testimonial = await db.websiteTestimonial.findUnique({ where: { id } })

    if (!testimonial) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return NextResponse.json({ testimonial })
  }
)

export const PATCH = withMiddleware({ requireAuth: true, requiredPermission: "website:configure" })(
  async (req: AuthenticatedRequest, ctx?: Ctx) => {
    const params = await ctx?.params
    const id = params?.id as string | undefined
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

    const body = await req.json()

    const allowed = ["customerName", "business", "designation", "review", "rating", "photo", "displayOrder", "isVisible"]
    const data: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body) data[key] = body[key]
    }

    // Validate input
    const validation = validateWebsiteTestimonial(data)
    if (!validation.valid) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.errors },
        { status: 400 }
      )
    }

    // Get existing data for audit
    const existing = await db.websiteTestimonial.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const testimonial = await db.websiteTestimonial.update({
      where: { id },
      data,
    })

    // Log audit
    await logWebsiteAudit({
      userId: req.user?.id,
      userName: req.user?.name,
      email: req.user?.email,
      role: req.user?.role,
      action: "UPDATE",
      resourceType: "WebsiteTestimonial",
      resourceId: id,
      description: `Updated testimonial from ${testimonial.customerName}`,
      oldValues: JSON.parse(JSON.stringify(existing)),
      newValues: JSON.parse(JSON.stringify(testimonial)),
    })

    return NextResponse.json({ testimonial })
  }
)

export const DELETE = withMiddleware({ requireAuth: true, requiredPermission: "website:configure" })(
  async (req: AuthenticatedRequest, ctx?: Ctx) => {
    const params = await ctx?.params
    const id = params?.id as string | undefined
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

    const existing = await db.websiteTestimonial.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    await db.websiteTestimonial.delete({ where: { id } })

    // Log audit
    await logWebsiteAudit({
      userId: req.user?.id,
      userName: req.user?.name,
      email: req.user?.email,
      role: req.user?.role,
      action: "DELETE",
      resourceType: "WebsiteTestimonial",
      resourceId: id,
      description: `Deleted testimonial from ${existing.customerName}`,
      oldValues: JSON.parse(JSON.stringify(existing)),
    })

    return NextResponse.json({ success: true })
  }
)
