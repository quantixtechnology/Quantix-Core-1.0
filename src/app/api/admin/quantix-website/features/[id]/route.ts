import { NextResponse } from "next/server"
import { withMiddleware } from "@/lib/middleware"
import { db } from "@/lib/db"
import { validateWebsiteFeature } from "@/lib/website-validation"
import { logWebsiteAudit } from "@/lib/website-audit"
import type { NextRequest } from "next/server"

interface AuthenticatedRequest extends NextRequest {
  user?: { id: string; name: string; email: string; role: string }
}

type Ctx = { params?: Promise<Record<string, string | string[]>> }

export const PATCH = withMiddleware({ requireAuth: true, requiredPermission: "website:configure" })(
  async (req: AuthenticatedRequest, ctx?: Ctx) => {
    const params = await ctx?.params
    const id = params?.id as string | undefined
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

    const body = await req.json()

    // Validate input
    const validation = validateWebsiteFeature(body)
    if (!validation.valid) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.errors },
        { status: 400 }
      )
    }

    const allowed = ["title", "subtitle", "description", "icon", "displayOrder", "isVisible"]
    const data: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body) data[key] = body[key]
    }

    // Get existing data for audit
    const existing = await db.websiteFeature.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Feature not found" }, { status: 404 })
    }

    const feature = await db.websiteFeature.update({
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
      resourceType: "WebsiteFeature",
      resourceId: feature.id,
      description: `Updated feature: ${feature.title}`,
      oldValues: JSON.parse(JSON.stringify(existing)),
      newValues: JSON.parse(JSON.stringify(feature)),
    })

    return NextResponse.json({ feature })
  }
)

export const DELETE = withMiddleware({ requireAuth: true, requiredPermission: "website:configure" })(
  async (req: AuthenticatedRequest, ctx?: Ctx) => {
    const params = await ctx?.params
    const id = params?.id as string | undefined
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

    const feature = await db.websiteFeature.findUnique({ where: { id } })
    if (!feature) {
      return NextResponse.json({ error: "Feature not found" }, { status: 404 })
    }

    await db.websiteFeature.delete({ where: { id } })

    // Log audit
    await logWebsiteAudit({
      userId: req.user?.id,
      userName: req.user?.name,
      email: req.user?.email,
      role: req.user?.role,
      action: "DELETE",
      resourceType: "WebsiteFeature",
      resourceId: feature.id,
      description: `Deleted feature: ${feature.title}`,
      oldValues: JSON.parse(JSON.stringify(feature)),
    })

    return NextResponse.json({ success: true })
  }
)
