// GET  /api/core/commerce/templates/[id]/pages — pages + sections for the detail
//        screen and (Phase 4) the builder.
// POST /api/core/commerce/templates/[id]/pages — create a page, optionally with
//        an initial section list. Foundation for the visual builder (Phase 4) so
//        it never bypasses Phase 2 CRUD. Validates: template exists + not
//        archived, unique slug, section types against the component registry,
//        sort order normalised, at most one home page.
import { NextResponse } from "next/server"
import { withMiddleware } from "@/lib/middleware"
import { db } from "@/lib/db"
import { getSectionDef } from "@/lib/commerce/section-registry"
import { isReservedRoute } from "@/lib/commerce/reserved-routes"

export const runtime = "nodejs"
const PLATFORM: Parameters<typeof withMiddleware>[0] = { requireAuth: true, requiredRoles: ["QUANTIX_SUPER_ADMIN", "PLATFORM_ADMIN"] }

const json = (v: unknown) => (v == null ? null : JSON.stringify(v))

export const GET = withMiddleware(PLATFORM)(async (_request, ctx) => {
  const { id } = await (ctx as { params: Promise<{ id: string }> }).params
  const pages = await db.commerceTemplatePage.findMany({
    where: { templateId: id },
    include: { sections: { orderBy: { sortOrder: "asc" } } },
    orderBy: { sortOrder: "asc" },
  })
  return NextResponse.json({ success: true, data: pages })
})

export const POST = withMiddleware(PLATFORM)(async (request, ctx) => {
  const { id } = await (ctx as { params: Promise<{ id: string }> }).params
  const b = await request.json().catch(() => ({}))

  const template = await db.commerceTemplate.findUnique({ where: { id }, select: { id: true, status: true } })
  if (!template) return NextResponse.json({ success: false, error: "Template not found" }, { status: 404 })
  if (template.status === "ARCHIVED") return NextResponse.json({ success: false, error: "Cannot add pages to an archived template" }, { status: 409 })

  const name = String(b.name || "").trim()
  if (!name) return NextResponse.json({ success: false, error: "Page name is required" }, { status: 400 })
  const slug = String(b.slug || name).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "page"

  // Custom pages must not shadow reserved functional storefront routes. The
  // template's own HOME page is exempt (it is the storefront root, not a
  // catalogue/system route).
  const isHomePage = !!b.isHomePage
  if (!isHomePage && isReservedRoute(slug)) {
    return NextResponse.json({ success: false, error: `Slug "${slug}" is a reserved storefront route and cannot be used for a custom page` }, { status: 409 })
  }

  const clash = await db.commerceTemplatePage.findUnique({ where: { templateId_slug: { templateId: id, slug } }, select: { id: true } })
  if (clash) return NextResponse.json({ success: false, error: `Page slug "${slug}" already exists in this template` }, { status: 409 })

  // Validate initial sections against the registry.
  const sections = Array.isArray(b.sections) ? b.sections : []
  for (const s of sections) {
    if (!getSectionDef(String(s.sectionType))) return NextResponse.json({ success: false, error: `Unknown section type "${s.sectionType}"` }, { status: 400 })
  }

  // Enforce a single home page.
  const isHome = !!b.isHomePage
  if (isHome) await db.commerceTemplatePage.updateMany({ where: { templateId: id, isHomePage: true }, data: { isHomePage: false } })

  const maxOrder = await db.commerceTemplatePage.aggregate({ where: { templateId: id }, _max: { sortOrder: true } })
  const page = await db.commerceTemplatePage.create({
    data: {
      templateId: id, name, slug,
      pageType: b.pageType || (isHome ? "HOME" : "CUSTOM"),
      route: b.route || (isHome ? "/" : `/${slug}`),
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      isHomePage: isHome, status: b.status === "ACTIVE" ? "ACTIVE" : "DRAFT",
      seoConfig: json(b.seoConfig),
      sections: {
        create: sections.map((s: Record<string, unknown>, i: number) => {
          const def = getSectionDef(String(s.sectionType))!
          return {
            sectionType: String(s.sectionType), sectionKey: (s.sectionKey as string) || null, sortOrder: i,
            layoutConfig: json(s.layoutConfig ?? def.defaultConfig.layoutConfig),
            styleConfig: json(s.styleConfig ?? def.defaultConfig.styleConfig),
            visibilityConfig: json(s.visibilityConfig ?? def.defaultConfig.visibilityConfig),
            dataSourceConfig: json(s.dataSourceConfig ?? def.defaultConfig.dataSourceConfig),
            contentConfig: json(s.contentConfig ?? def.defaultConfig.contentConfig),
          }
        }),
      },
    },
    include: { sections: { orderBy: { sortOrder: "asc" } } },
  })
  return NextResponse.json({ success: true, data: page }, { status: 201 })
})
