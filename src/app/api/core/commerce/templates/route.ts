// GET  /api/core/commerce/templates — Commerce Template Library (platform).
// POST /api/core/commerce/templates — create a master template.
// Master templates belong to Quantix Core; never tenant-accessible.
import { NextResponse } from "next/server"
import { withMiddleware } from "@/lib/middleware"
import { db } from "@/lib/db"
import { uniqueTemplateCode, setTemplateCategories } from "@/lib/commerce/template-service"

export const runtime = "nodejs"

const PLATFORM: Parameters<typeof withMiddleware>[0] = { requireAuth: true, requiredRoles: ["QUANTIX_SUPER_ADMIN", "PLATFORM_ADMIN"] }

export const GET = withMiddleware(PLATFORM)(async (request) => {
  const sp = new URL(request.url).searchParams
  const workspaceType = sp.get("workspaceType") || "COMMERCE"
  const category = sp.get("businessCategory")
  const status = sp.get("status")

  const where: Record<string, unknown> = { workspaceType }
  if (status) where.status = status
  // Category filter matches primary OR compatibility join.
  if (category) where.OR = [{ businessCategory: category }, { categories: { some: { businessCategory: category } } }]

  const templates = await db.commerceTemplate.findMany({
    where,
    include: {
      categories: { select: { businessCategory: true } },
      _count: { select: { pages: true, assignments: true } },
    },
    orderBy: [{ businessCategory: "asc" }, { name: "asc" }],
  })

  // Which templates are a category default (authoritative mapping).
  const defaults = await db.commerceCategoryDefault.findMany({ where: { workspaceType }, select: { businessCategory: true, templateId: true } })
  const defaultByTemplate = new Map<string, string[]>()
  for (const d of defaults) (defaultByTemplate.get(d.templateId) || defaultByTemplate.set(d.templateId, []).get(d.templateId)!).push(d.businessCategory)

  const shaped = templates.map((t) => ({
    id: t.id, code: t.code, name: t.name, description: t.description,
    businessCategory: t.businessCategory,
    compatibleCategories: [...new Set([t.businessCategory, ...t.categories.map((c) => c.businessCategory)])],
    status: t.status, version: t.version, publishedVersion: t.publishedVersion, publishedAt: t.publishedAt,
    thumbnailUrl: t.thumbnailUrl, pages: t._count.pages, assignments: t._count.assignments,
    defaultForCategories: defaultByTemplate.get(t.id) || [],
    updatedAt: t.updatedAt,
  }))

  // Group by primary category for the Library tree.
  const byCategory: Record<string, typeof shaped> = {}
  for (const t of shaped) (byCategory[t.businessCategory] ||= []).push(t)

  return NextResponse.json({ success: true, data: shaped, byCategory, total: shaped.length })
})

export const POST = withMiddleware(PLATFORM)(async (request) => {
  const b = await request.json().catch(() => ({}))
  const name = String(b.name || "").trim()
  const primaryCategory = String(b.businessCategory || "").trim()
  if (!name) return NextResponse.json({ success: false, error: "name is required" }, { status: 400 })
  if (!primaryCategory) return NextResponse.json({ success: false, error: "businessCategory is required" }, { status: 400 })

  const code = b.code ? await uniqueTemplateCode(String(b.code)) : await uniqueTemplateCode(name)
  const compatible: string[] = Array.isArray(b.compatibleCategories) ? b.compatibleCategories.map(String) : []

  const actor = (request as unknown as { user?: { name?: string } }).user?.name || null
  const created = await db.commerceTemplate.create({
    data: {
      code, name,
      description: b.description ? String(b.description) : null,
      workspaceType: b.workspaceType || "COMMERCE",
      businessCategory: primaryCategory,
      templateType: b.templateType || "STOREFRONT",
      thumbnailUrl: b.thumbnailUrl || null,
      status: "DRAFT", version: 1, publishedVersion: 0,
      createdBy: actor,
    },
    select: { id: true, code: true },
  })
  await setTemplateCategories(created.id, primaryCategory, compatible)

  return NextResponse.json({ success: true, data: created }, { status: 201 })
})
