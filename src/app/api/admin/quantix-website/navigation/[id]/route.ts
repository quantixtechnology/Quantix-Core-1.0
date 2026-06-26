import { NextResponse } from "next/server"
import { withMiddleware } from "@/lib/middleware"
import { db } from "@/lib/db"
import { validateWebsiteNavigation } from "@/lib/website-validation"
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

    const item = await db.websiteNavigation.findUnique({ where: { id } })

    if (!item) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return NextResponse.json({ item })
  }
)

export const PATCH = withMiddleware({ requireAuth: true, requiredPermission: "website:configure" })(
  async (req: AuthenticatedRequest, ctx?: Ctx) => {
    const params = await ctx?.params
    const id = params?.id as string | undefined
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

    const body = await req.json()

    const allowed = ["menuName", "url", "target", "isExternal", "displayOrder", "openInNewTab", "isVisible", "parentMenuId"]
    const data: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body) data[key] = body[key]
    }

    // Validate input
    const validation = validateWebsiteNavigation(data)
    if (!validation.valid) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.errors },
        { status: 400 }
      )
    }

    // Get existing data for audit
    const existing = await db.websiteNavigation.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const item = await db.websiteNavigation.update({
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
      resourceType: "WebsiteNavigation",
      resourceId: id,
      description: `Updated navigation menu item: ${item.menuName}`,
      oldValues: JSON.parse(JSON.stringify(existing)),
      newValues: JSON.parse(JSON.stringify(item)),
    })

    return NextResponse.json({ item })
  }
)

export const DELETE = withMiddleware({ requireAuth: true, requiredPermission: "website:configure" })(
  async (req: AuthenticatedRequest, ctx?: Ctx) => {
    const params = await ctx?.params
    const id = params?.id as string | undefined
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

    const existing = await db.websiteNavigation.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    await db.websiteNavigation.delete({ where: { id } })

    // Log audit
    await logWebsiteAudit({
      userId: req.user?.id,
      userName: req.user?.name,
      email: req.user?.email,
      role: req.user?.role,
      action: "DELETE",
      resourceType: "WebsiteNavigation",
      resourceId: id,
      description: `Deleted navigation menu item: ${existing.menuName}`,
      oldValues: JSON.parse(JSON.stringify(existing)),
    })

    return NextResponse.json({ success: true })
  }
)
