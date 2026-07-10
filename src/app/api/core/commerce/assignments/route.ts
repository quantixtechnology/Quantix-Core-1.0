// GET  /api/core/commerce/assignments?businessId= — a Commerce business's
//        resolved template, resolution source, current explicit assignment, and
//        the compatible ACTIVE templates it may be assigned.
// POST /api/core/commerce/assignments — assign a template to a business (or
//        store), server-side compatibility + ownership enforced.
// DELETE /api/core/commerce/assignments?businessId=&storeId= — remove the
//        explicit assignment (business returns to CATEGORY_DEFAULT / fallback).
import { NextResponse } from "next/server"
import { withMiddleware } from "@/lib/middleware"
import { db } from "@/lib/db"
import { resolveTemplateForBusiness, isTemplateCompatible, getTemplateCategories } from "@/lib/commerce/template-resolver"
import { getCommerceRendererMode } from "@/lib/commerce/renderer-mode"

export const runtime = "nodejs"
const PLATFORM: Parameters<typeof withMiddleware>[0] = { requireAuth: true, requiredRoles: ["QUANTIX_SUPER_ADMIN", "PLATFORM_ADMIN"] }

async function loadBusiness(businessId: string) {
  return db.business.findUnique({ where: { id: businessId }, select: { id: true, name: true, businessType: true, productCode: true } })
}

export const GET = withMiddleware(PLATFORM)(async (request) => {
  const sp = new URL(request.url).searchParams
  const businessId = sp.get("businessId")
  if (!businessId) return NextResponse.json({ success: false, error: "businessId required" }, { status: 400 })
  const business = await loadBusiness(businessId)
  if (!business) return NextResponse.json({ success: false, error: "Business not found" }, { status: 404 })

  const workspaceType = business.productCode || "COMMERCE"
  const resolved = await resolveTemplateForBusiness({ businessId, storeId: sp.get("storeId"), businessCategory: business.businessType, workspaceType })

  const explicit = await db.commerceTemplateAssignment.findMany({
    where: { businessId, status: "ACTIVE" },
    include: { template: { select: { id: true, code: true, name: true } } },
  })

  // Compatible ACTIVE templates for this business category — enriched for the
  // Licensed Features template gallery (cards).
  const candidates = await db.commerceTemplate.findMany({
    where: { workspaceType, status: "ACTIVE" },
    select: {
      id: true, code: true, name: true, description: true, thumbnailUrl: true, publishedVersion: true,
      businessCategory: true, categories: { select: { businessCategory: true } },
      _count: { select: { pages: true } },
    },
  })
  const categoryDefault = await db.commerceCategoryDefault
    .findUnique({ where: { workspaceType_businessCategory: { workspaceType, businessCategory: business.businessType } }, select: { templateId: true } })
    .catch(() => null)
  const compatible = candidates
    .filter((t) => [t.businessCategory, ...t.categories.map((c) => c.businessCategory)].includes(business.businessType))
    .map((t) => ({
      id: t.id, code: t.code, name: t.name, description: t.description, thumbnailUrl: t.thumbnailUrl,
      publishedVersion: t.publishedVersion, pageCount: t._count.pages,
      compatibleCategories: [...new Set([t.businessCategory, ...t.categories.map((c) => c.businessCategory)])],
      isCategoryDefault: categoryDefault?.templateId === t.id,
    }))

  const rendererMode = await getCommerceRendererMode(businessId)

  return NextResponse.json({
    success: true,
    data: {
      business: { id: business.id, name: business.name, businessType: business.businessType, workspaceType, isCommerce: workspaceType === "COMMERCE" },
      resolved,
      rendererMode,
      explicitAssignments: explicit.map((a) => ({ storeId: a.storeId, template: a.template })),
      compatibleTemplates: compatible,
    },
  })
})

export const POST = withMiddleware(PLATFORM)(async (request) => {
  const b = await request.json().catch(() => ({}))
  const businessId = String(b.businessId || "")
  const templateId = String(b.templateId || "")
  const storeId = b.storeId ? String(b.storeId) : null
  if (!businessId || !templateId) return NextResponse.json({ success: false, error: "businessId and templateId required" }, { status: 400 })

  const business = await loadBusiness(businessId)
  if (!business) return NextResponse.json({ success: false, error: "Business not found" }, { status: 404 })
  // Commerce workspace only.
  if ((business.productCode || "") !== "COMMERCE") {
    return NextResponse.json({ success: false, error: "Template assignment applies only to COMMERCE businesses" }, { status: 409 })
  }

  const template = await db.commerceTemplate.findUnique({ where: { id: templateId }, select: { id: true, status: true, workspaceType: true } })
  if (!template) return NextResponse.json({ success: false, error: "Template not found" }, { status: 404 })
  if (template.status !== "ACTIVE") return NextResponse.json({ success: false, error: "Only ACTIVE templates can be assigned" }, { status: 409 })
  // Server-side category compatibility (never UI-only).
  if (!(await isTemplateCompatible(templateId, business.businessType))) {
    const cats = await getTemplateCategories(templateId)
    return NextResponse.json({ success: false, error: `Template is not compatible with ${business.businessType} (compatible: ${cats.join(", ")})` }, { status: 409 })
  }
  // Store ownership if a store override.
  if (storeId) {
    const store = await db.store.findFirst({ where: { id: storeId, businessId }, select: { id: true } })
    if (!store) return NextResponse.json({ success: false, error: "Store not found for this business" }, { status: 404 })
  }

  const actor = (request as unknown as { user?: { name?: string } }).user?.name || null
  // Manual upsert — SQLite treats NULL storeId as distinct in the unique index,
  // so a compound-unique upsert on a null component is unreliable.
  const existing = await db.commerceTemplateAssignment.findFirst({ where: { businessId, storeId }, select: { id: true } })
  const saved = existing
    ? await db.commerceTemplateAssignment.update({ where: { id: existing.id }, data: { templateId, status: "ACTIVE", assignedBy: actor }, select: { id: true, businessId: true, storeId: true, templateId: true } })
    : await db.commerceTemplateAssignment.create({ data: { businessId, storeId, templateId, status: "ACTIVE", assignedBy: actor }, select: { id: true, businessId: true, storeId: true, templateId: true } })
  return NextResponse.json({ success: true, data: saved })
})

export const DELETE = withMiddleware(PLATFORM)(async (request) => {
  const sp = new URL(request.url).searchParams
  const businessId = sp.get("businessId")
  const storeId = sp.get("storeId") || null
  if (!businessId) return NextResponse.json({ success: false, error: "businessId required" }, { status: 400 })
  await db.commerceTemplateAssignment.deleteMany({ where: { businessId, storeId } })
  return NextResponse.json({ success: true, removed: true })
})
