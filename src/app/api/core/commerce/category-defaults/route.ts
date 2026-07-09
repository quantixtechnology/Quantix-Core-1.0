// GET  /api/core/commerce/category-defaults — category → default template map
//        for every Commerce business category (incl. categories with no default).
// POST /api/core/commerce/category-defaults — set/change a category default.
// Enforced: only an ACTIVE template compatible with the category can be default;
// exactly one default per workspaceType+category. Changing the default NEVER
// touches explicit business assignments or tenant instances (they take priority
// in the resolver).
import { NextResponse } from "next/server"
import { withMiddleware } from "@/lib/middleware"
import { db } from "@/lib/db"
import { isTemplateCompatible } from "@/lib/commerce/template-resolver"

export const runtime = "nodejs"
const PLATFORM: Parameters<typeof withMiddleware>[0] = { requireAuth: true, requiredRoles: ["QUANTIX_SUPER_ADMIN", "PLATFORM_ADMIN"] }

// The Commerce business categories (Business.businessType values that render a
// Commerce storefront). GROCERY included; it is NOT the generic fallback.
const COMMERCE_CATEGORIES = ["GROCERY", "ECOMMERCE", "MEAT_DELIVERY", "COSMETICS", "FURNITURE"]

export const GET = withMiddleware(PLATFORM)(async (request) => {
  const workspaceType = new URL(request.url).searchParams.get("workspaceType") || "COMMERCE"
  const rows = await db.commerceCategoryDefault.findMany({
    where: { workspaceType },
    include: { template: { select: { id: true, code: true, name: true, status: true } } },
  })
  const byCategory = new Map(rows.map((r) => [r.businessCategory, r]))

  const data = COMMERCE_CATEGORIES.map((cat) => {
    const m = byCategory.get(cat)
    return {
      businessCategory: cat,
      defaultTemplate: m?.template ? { id: m.template.id, code: m.template.code, name: m.template.name, status: m.template.status } : null,
      configured: !!m,
    }
  })
  return NextResponse.json({ success: true, data })
})

export const POST = withMiddleware(PLATFORM)(async (request) => {
  const b = await request.json().catch(() => ({}))
  const workspaceType = b.workspaceType || "COMMERCE"
  const businessCategory = String(b.businessCategory || "").trim()
  const templateId = b.templateId ? String(b.templateId) : null
  if (!businessCategory) return NextResponse.json({ success: false, error: "businessCategory is required" }, { status: 400 })

  // Clearing the default.
  if (!templateId) {
    await db.commerceCategoryDefault.deleteMany({ where: { workspaceType, businessCategory } })
    return NextResponse.json({ success: true, cleared: true })
  }

  const template = await db.commerceTemplate.findUnique({ where: { id: templateId }, select: { id: true, status: true, workspaceType: true } })
  if (!template) return NextResponse.json({ success: false, error: "Template not found" }, { status: 404 })
  if (template.workspaceType !== workspaceType) return NextResponse.json({ success: false, error: "Template belongs to a different workspace type" }, { status: 400 })
  if (template.status !== "ACTIVE") return NextResponse.json({ success: false, error: "Only an ACTIVE template can be a category default" }, { status: 409 })
  if (!(await isTemplateCompatible(templateId, businessCategory))) {
    return NextResponse.json({ success: false, error: `Template is not compatible with ${businessCategory}` }, { status: 409 })
  }

  const actor = (request as unknown as { user?: { name?: string } }).user?.name || null
  const saved = await db.commerceCategoryDefault.upsert({
    where: { workspaceType_businessCategory: { workspaceType, businessCategory } },
    update: { templateId, updatedBy: actor },
    create: { workspaceType, businessCategory, templateId, updatedBy: actor },
    select: { businessCategory: true, templateId: true },
  })
  // Keep the convenience isDefault flag roughly in sync for display.
  await db.commerceTemplate.update({ where: { id: templateId }, data: { isDefault: true } }).catch(() => {})

  return NextResponse.json({ success: true, data: saved })
})
