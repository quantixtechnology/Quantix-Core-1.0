// Controlled COMMERCE business-category (Business.businessType) management.
//
// businessType is deliberately ABSENT from the generic updateBusiness allowed
// fields, so tenant-facing edits can never mutate the authoritative category.
// This platform-only endpoint is the single safe path to change it, with server
// validation and a template-resolution consequence preview.
//
// GET  ?businessId=&newCategory=  → consequence preview (no mutation)
// POST { businessId, businessType, removeIncompatibleAssignment? } → apply
import { NextResponse } from "next/server"
import { withMiddleware } from "@/lib/middleware"
import { db } from "@/lib/db"
import { COMMERCE_BUSINESS_CATEGORIES, commerceCategoryLabel, isCommerceCategory } from "@/lib/commerce/commerce-categories"
import { resolveTemplateForBusiness, isTemplateCompatible } from "@/lib/commerce/template-resolver"

export const runtime = "nodejs"
const PLATFORM: Parameters<typeof withMiddleware>[0] = { requireAuth: true, requiredRoles: ["QUANTIX_SUPER_ADMIN", "PLATFORM_ADMIN"] }

async function loadBiz(businessId: string) {
  return db.business.findUnique({ where: { id: businessId }, select: { id: true, name: true, businessType: true, productCode: true } })
}

// Resolve the category default template for a category (code+name) if one exists.
async function categoryDefaultTemplate(businessCategory: string) {
  const def = await db.commerceCategoryDefault
    .findUnique({ where: { workspaceType_businessCategory: { workspaceType: "COMMERCE", businessCategory } }, include: { template: { select: { id: true, code: true, name: true, status: true } } } })
    .catch(() => null)
  return def?.template && def.template.status === "ACTIVE" ? { id: def.template.id, code: def.template.code, name: def.template.name } : null
}

// Shared consequence computation for a proposed category change.
async function consequence(businessId: string, currentCategory: string, newCategory: string) {
  // Current explicit business-level assignment (if any).
  const explicit = await db.commerceTemplateAssignment.findFirst({
    where: { businessId, storeId: null, status: "ACTIVE" },
    include: { template: { select: { id: true, code: true, name: true } } },
  })
  const explicitCompatibleWithNew = explicit?.template ? await isTemplateCompatible(explicit.template.id, newCategory) : true
  const newDefault = await categoryDefaultTemplate(newCategory)

  let action: "KEEP_ASSIGNMENT" | "REMOVE_INCOMPATIBLE_ASSIGNMENT" | "USE_NEW_DEFAULT"
  if (explicit?.template) action = explicitCompatibleWithNew ? "KEEP_ASSIGNMENT" : "REMOVE_INCOMPATIBLE_ASSIGNMENT"
  else action = "USE_NEW_DEFAULT"

  return {
    current: { category: currentCategory, label: commerceCategoryLabel(currentCategory) },
    proposed: {
      category: newCategory, label: commerceCategoryLabel(newCategory),
      newCategoryDefault: newDefault, // {code,name} | null (→ neutral fallback)
      explicitAssignment: explicit?.template ? { id: explicit.template.id, code: explicit.template.code, name: explicit.template.name } : null,
      explicitCompatibleWithNew,
      action,
      requiresConfirmation: action === "REMOVE_INCOMPATIBLE_ASSIGNMENT",
    },
  }
}

export const GET = withMiddleware(PLATFORM)(async (request) => {
  const sp = new URL(request.url).searchParams
  const businessId = sp.get("businessId")
  const newCategory = sp.get("newCategory")
  if (!businessId) return NextResponse.json({ success: false, error: "businessId required" }, { status: 400 })
  const biz = await loadBiz(businessId)
  if (!biz) return NextResponse.json({ success: false, error: "Business not found" }, { status: 404 })
  if ((biz.productCode || "").toUpperCase() !== "COMMERCE") {
    return NextResponse.json({ success: false, error: "Business category management applies only to COMMERCE businesses" }, { status: 409 })
  }
  if (!newCategory) {
    // No proposed change — just report current resolution + the supported vocab.
    const resolved = await resolveTemplateForBusiness({ businessId, storeId: null, businessCategory: biz.businessType, workspaceType: "COMMERCE" })
    return NextResponse.json({ success: true, data: {
      businessId, current: { category: biz.businessType, label: commerceCategoryLabel(biz.businessType), resolvedTemplate: { code: resolved.code, name: resolved.name }, source: resolved.source },
      categories: COMMERCE_BUSINESS_CATEGORIES,
    } })
  }
  if (!isCommerceCategory(newCategory)) return NextResponse.json({ success: false, error: `Unsupported Commerce category "${newCategory}"` }, { status: 400 })
  const preview = await consequence(businessId, biz.businessType, newCategory)
  return NextResponse.json({ success: true, data: { businessId, ...preview, categories: COMMERCE_BUSINESS_CATEGORIES } })
})

export const POST = withMiddleware(PLATFORM)(async (request) => {
  const b = await request.json().catch(() => ({}))
  const businessId = String(b.businessId || "")
  const businessType = String(b.businessType || "")
  const removeIncompatible = b.removeIncompatibleAssignment === true
  if (!businessId || !businessType) return NextResponse.json({ success: false, error: "businessId and businessType required" }, { status: 400 })

  const biz = await loadBiz(businessId)
  if (!biz) return NextResponse.json({ success: false, error: "Business not found" }, { status: 404 })
  // Never trust arbitrary client text; only COMMERCE, only supported vocab.
  if ((biz.productCode || "").toUpperCase() !== "COMMERCE") {
    return NextResponse.json({ success: false, error: "Business category management applies only to COMMERCE businesses" }, { status: 409 })
  }
  if (!isCommerceCategory(businessType)) {
    return NextResponse.json({ success: false, error: `Unsupported Commerce category "${businessType}"` }, { status: 400 })
  }

  // Handle an incompatible explicit assignment safely — never leave it invalid.
  const pre = await consequence(businessId, biz.businessType, businessType)
  if (pre.proposed.action === "REMOVE_INCOMPATIBLE_ASSIGNMENT" && !removeIncompatible) {
    return NextResponse.json({
      success: false, error: "The current explicit template assignment is not compatible with the new category. Confirm to remove it and fall back to the new category default.",
      requiresConfirmation: true, consequence: pre,
    }, { status: 409 })
  }
  if (pre.proposed.action === "REMOVE_INCOMPATIBLE_ASSIGNMENT" && removeIncompatible) {
    await db.commerceTemplateAssignment.deleteMany({ where: { businessId, storeId: null } })
  }

  await db.business.update({ where: { id: businessId }, data: { businessType: businessType as never } })

  // Report the resulting resolution under the new category.
  const resolved = await resolveTemplateForBusiness({ businessId, storeId: null, businessCategory: businessType, workspaceType: "COMMERCE" })
  return NextResponse.json({ success: true, data: {
    businessId, businessType, label: commerceCategoryLabel(businessType),
    resolvedTemplate: { code: resolved.code, name: resolved.name }, source: resolved.source,
    removedIncompatibleAssignment: pre.proposed.action === "REMOVE_INCOMPATIBLE_ASSIGNMENT" && removeIncompatible,
  } })
})
