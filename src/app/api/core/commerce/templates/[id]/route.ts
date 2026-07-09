// GET  /api/core/commerce/templates/[id] — full template detail (pages/sections/
//        compatibility/usage/publication).
// PUT  /api/core/commerce/templates/[id] — edit metadata + compatible categories.
// DELETE — refused when in use; archive instead (safe semantics).
import { NextResponse } from "next/server"
import { withMiddleware } from "@/lib/middleware"
import { db } from "@/lib/db"
import { setTemplateCategories, templateUsage } from "@/lib/commerce/template-service"

export const runtime = "nodejs"
const PLATFORM: Parameters<typeof withMiddleware>[0] = { requireAuth: true, requiredRoles: ["QUANTIX_SUPER_ADMIN", "PLATFORM_ADMIN"] }

export const GET = withMiddleware(PLATFORM)(async (_request, ctx) => {
  const { id } = await (ctx as { params: Promise<{ id: string }> }).params
  const t = await db.commerceTemplate.findUnique({
    where: { id },
    include: {
      categories: { select: { businessCategory: true } },
      pages: {
        orderBy: { sortOrder: "asc" },
        include: { sections: { orderBy: { sortOrder: "asc" }, select: { id: true, sectionType: true, sectionKey: true, sortOrder: true } } },
      },
    },
  })
  if (!t) return NextResponse.json({ success: false, error: "Template not found" }, { status: 404 })
  const usage = await templateUsage(id)
  return NextResponse.json({
    success: true,
    data: {
      ...t,
      compatibleCategories: [...new Set([t.businessCategory, ...t.categories.map((c) => c.businessCategory)])],
      usage,
    },
  })
})

export const PUT = withMiddleware(PLATFORM)(async (request, ctx) => {
  const { id } = await (ctx as { params: Promise<{ id: string }> }).params
  const b = await request.json().catch(() => ({}))
  const existing = await db.commerceTemplate.findUnique({ where: { id }, select: { id: true, businessCategory: true } })
  if (!existing) return NextResponse.json({ success: false, error: "Template not found" }, { status: 404 })

  const data: Record<string, unknown> = {}
  if (typeof b.name === "string" && b.name.trim()) data.name = b.name.trim()
  if ("description" in b) data.description = b.description ? String(b.description) : null
  if ("thumbnailUrl" in b) data.thumbnailUrl = b.thumbnailUrl || null
  if (typeof b.businessCategory === "string" && b.businessCategory.trim()) data.businessCategory = b.businessCategory.trim()

  const updated = await db.commerceTemplate.update({ where: { id }, data, select: { id: true, businessCategory: true } })

  // Compatible categories (always includes primary).
  if (Array.isArray(b.compatibleCategories)) {
    await setTemplateCategories(id, updated.businessCategory, b.compatibleCategories.map(String))
  } else if (data.businessCategory) {
    // Primary changed — ensure it's in the compatibility set.
    const cats = await db.commerceTemplateCategory.findMany({ where: { templateId: id }, select: { businessCategory: true } })
    await setTemplateCategories(id, updated.businessCategory, cats.map((c) => c.businessCategory))
  }

  return NextResponse.json({ success: true, data: updated })
})

export const DELETE = withMiddleware(PLATFORM)(async (_request, ctx) => {
  const { id } = await (ctx as { params: Promise<{ id: string }> }).params
  const usage = await templateUsage(id)
  if (usage.inUse) {
    return NextResponse.json({ success: false, error: "Template is in use (defaults/assignments/tenant instances) — archive it instead.", usage: usage.counts }, { status: 409 })
  }
  // Unused → safe to archive (never hard-delete referenced platform assets).
  await db.commerceTemplate.update({ where: { id }, data: { status: "ARCHIVED" } })
  return NextResponse.json({ success: true, archived: true })
})
