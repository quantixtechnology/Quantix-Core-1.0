// Commerce master-template SERVICE — platform-owned CRUD/publish/duplicate/usage
// logic shared by the API routes. Master templates belong to Quantix Core; this
// never touches tenant instances or catalogue data.
import { db } from "@/lib/db"
import { getSectionDef } from "@/lib/commerce/section-registry"

// ── Template code generation (stable, unique, slug-safe) ─────────────────────
export function slugifyCode(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "template"
}

export async function uniqueTemplateCode(base: string): Promise<string> {
  const root = slugifyCode(base)
  let code = root
  let n = 1
  // Retry until free (bounded).
  while (await db.commerceTemplate.findUnique({ where: { code }, select: { id: true } })) {
    n += 1
    code = `${root}-${n}`
    if (n > 200) { code = `${root}-${Date.now().toString(36)}`; break }
  }
  return code
}

// ── Compatibility set management ─────────────────────────────────────────────
// Replace a template's compatible categories (join). Always includes the
// primary businessCategory.
export async function setTemplateCategories(templateId: string, primary: string, categories: string[]): Promise<void> {
  const set = new Set([primary, ...categories].filter(Boolean))
  await db.$transaction([
    db.commerceTemplateCategory.deleteMany({ where: { templateId } }),
    db.commerceTemplateCategory.createMany({ data: [...set].map((businessCategory) => ({ templateId, businessCategory })) }),
  ])
}

// ── Publish lifecycle (master) ───────────────────────────────────────────────
// Snapshot the current pages/sections (the DRAFT working content) into
// publishedConfig; keep the prior published snapshot for rollback; bump
// publishedVersion. Never mutates operational status.
export interface PublishResult { publishedVersion: number; pageCount: number; sectionCount: number }

export async function publishTemplate(templateId: string): Promise<PublishResult> {
  const template = await db.commerceTemplate.findUnique({
    where: { id: templateId },
    select: { id: true, status: true, publishedVersion: true, publishedConfig: true },
  })
  if (!template) throw new PublishError("Template not found", 404)
  if (template.status === "ARCHIVED") throw new PublishError("Archived templates cannot be published", 409)

  const pages = await db.commerceTemplatePage.findMany({
    where: { templateId },
    include: { sections: { orderBy: { sortOrder: "asc" } } },
    orderBy: { sortOrder: "asc" },
  })
  if (pages.length === 0) throw new PublishError("Template has no pages to publish", 409)
  const hasHome = pages.some((p) => p.isHomePage)
  if (!hasHome) throw new PublishError("Template must have a home page before publishing", 409)

  // Validate every section against the registry.
  const sectionCount = pages.reduce((s, p) => s + p.sections.length, 0)
  for (const p of pages) {
    for (const sec of p.sections) {
      if (!getSectionDef(sec.sectionType)) throw new PublishError(`Unknown section type "${sec.sectionType}" on page ${p.slug}`, 409)
    }
  }

  const snapshot = JSON.stringify({
    version: template.publishedVersion + 1,
    publishedAt: new Date().toISOString(),
    pages: pages.map((p) => ({
      id: p.id, name: p.name, slug: p.slug, pageType: p.pageType, route: p.route,
      sortOrder: p.sortOrder, isHomePage: p.isHomePage, seoConfig: safeJson(p.seoConfig),
      sections: p.sections.map((s) => ({
        id: s.id, sectionType: s.sectionType, sectionKey: s.sectionKey, sortOrder: s.sortOrder,
        layoutConfig: safeJson(s.layoutConfig), styleConfig: safeJson(s.styleConfig),
        visibilityConfig: safeJson(s.visibilityConfig), dataSourceConfig: safeJson(s.dataSourceConfig),
        contentConfig: safeJson(s.contentConfig),
      })),
    })),
  })

  const updated = await db.commerceTemplate.update({
    where: { id: templateId },
    data: {
      publishedVersion: template.publishedVersion + 1,
      publishedAt: new Date(),
      previousPublishedConfig: template.publishedConfig, // rollback safety
      publishedConfig: snapshot,
    },
    select: { publishedVersion: true },
  })
  return { publishedVersion: updated.publishedVersion, pageCount: pages.length, sectionCount }
}

export class PublishError extends Error {
  constructor(message: string, public status = 409) { super(message) }
}

// ── Deep clone (duplicate) ───────────────────────────────────────────────────
// Clones metadata + compatible categories + pages + sections + section config +
// draft content. Does NOT clone assignments, category-default status, tenant
// instances, or usage. Starts DRAFT with a fresh unique code.
export async function duplicateTemplate(sourceId: string, actor?: string | null): Promise<{ id: string; code: string }> {
  const src = await db.commerceTemplate.findUnique({
    where: { id: sourceId },
    include: { pages: { include: { sections: { orderBy: { sortOrder: "asc" } } }, orderBy: { sortOrder: "asc" } }, categories: true },
  })
  if (!src) throw new PublishError("Template not found", 404)

  const code = await uniqueTemplateCode(`${src.code}-copy`)
  const created = await db.commerceTemplate.create({
    data: {
      code, name: `${src.name} (Copy)`, description: src.description,
      workspaceType: src.workspaceType, businessCategory: src.businessCategory, templateType: src.templateType,
      thumbnailUrl: src.thumbnailUrl, previewUrl: src.previewUrl,
      status: "DRAFT", isDefault: false, version: 1, publishedVersion: 0,
      createdBy: actor || null,
      // clone compatible categories
      categories: { create: src.categories.map((c) => ({ businessCategory: c.businessCategory })) },
      // clone pages + sections (draft content)
      pages: {
        create: src.pages.map((p) => ({
          name: p.name, slug: p.slug, pageType: p.pageType, route: p.route,
          sortOrder: p.sortOrder, isHomePage: p.isHomePage, status: p.status, seoConfig: p.seoConfig,
          sections: {
            create: p.sections.map((s) => ({
              sectionType: s.sectionType, sectionKey: s.sectionKey, sortOrder: s.sortOrder,
              layoutConfig: s.layoutConfig, styleConfig: s.styleConfig, visibilityConfig: s.visibilityConfig,
              dataSourceConfig: s.dataSourceConfig, contentConfig: s.contentConfig,
            })),
          },
        })),
      },
    },
    select: { id: true, code: true },
  })
  return created
}

// ── Usage (before archive/deactivate) ────────────────────────────────────────
export async function templateUsage(templateId: string) {
  const [categoryDefaults, assignments, tenantInstances] = await Promise.all([
    db.commerceCategoryDefault.findMany({ where: { templateId }, select: { workspaceType: true, businessCategory: true } }),
    db.commerceTemplateAssignment.findMany({ where: { templateId }, select: { businessId: true, storeId: true, status: true } }),
    db.commerceTenantTemplate.findMany({ where: { sourceTemplateId: templateId }, select: { businessId: true, storeId: true, status: true } }),
  ])
  const businessAssignments = assignments.filter((a) => a.storeId === null)
  const storeAssignments = assignments.filter((a) => a.storeId !== null)
  return {
    categoryDefaults, businessAssignments, storeAssignments, tenantInstances,
    inUse: categoryDefaults.length + assignments.length + tenantInstances.length > 0,
    counts: { categoryDefaults: categoryDefaults.length, businessAssignments: businessAssignments.length, storeAssignments: storeAssignments.length, tenantInstances: tenantInstances.length },
  }
}

function safeJson(s: string | null): unknown { if (!s) return null; try { return JSON.parse(s) } catch { return null } }
