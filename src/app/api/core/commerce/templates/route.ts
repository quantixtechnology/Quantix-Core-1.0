// GET /api/core/commerce/templates — Quantix Core Commerce Template Library.
// Platform-authorized read of master templates (Phase 1 foundation; CRUD +
// category mapping + assignment land in Phase 2). Never tenant-accessible.
import { NextResponse } from "next/server"
import { withMiddleware } from "@/lib/middleware"
import { db } from "@/lib/db"

export const runtime = "nodejs"

export const GET = withMiddleware({ requireAuth: true, requiredRoles: ["QUANTIX_SUPER_ADMIN", "PLATFORM_ADMIN"] })(
  async (request) => {
    const sp = new URL(request.url).searchParams
    const category = sp.get("businessCategory")
    const status = sp.get("status")
    const where: Record<string, unknown> = { workspaceType: sp.get("workspaceType") || "COMMERCE" }
    if (category) where.businessCategory = category
    if (status) where.status = status

    const templates = await db.commerceTemplate.findMany({
      where,
      include: { _count: { select: { pages: true, assignments: true } } },
      orderBy: [{ businessCategory: "asc" }, { isDefault: "desc" }, { name: "asc" }],
    })

    // Group by category for the Library tree (Commerce → category → templates).
    const byCategory: Record<string, unknown[]> = {}
    for (const t of templates) {
      (byCategory[t.businessCategory] ||= []).push({
        id: t.id, code: t.code, name: t.name, description: t.description,
        status: t.status, isDefault: t.isDefault, version: t.version,
        thumbnailUrl: t.thumbnailUrl, pages: t._count.pages, assignments: t._count.assignments,
        updatedAt: t.updatedAt,
      })
    }

    return NextResponse.json({ success: true, data: templates, byCategory, total: templates.length })
  },
)
