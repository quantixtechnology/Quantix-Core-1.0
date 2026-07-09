// GET /api/core/commerce/resolve?businessId=&storeId= — production-safe
// storefront-resolution DIAGNOSTIC (platform-authorized). Reports exactly how a
// Commerce business's storefront resolves — businessType (category), the config
// path, and the template the resolver selects — WITHOUT bypassing auth, tenant
// isolation, or fabricating data. This is the instrument used to trace the live
// "missing categories/products" and Grocery-coupling behaviour on real tenants.
import { NextResponse } from "next/server"
import { withMiddleware } from "@/lib/middleware"
import { db } from "@/lib/db"
import { getBusinessTypeConfig } from "@/lib/business-type-config"
import { resolveTemplateForBusiness } from "@/lib/commerce/template-resolver"

export const runtime = "nodejs"

export const GET = withMiddleware({ requireAuth: true, requiredRoles: ["QUANTIX_SUPER_ADMIN", "PLATFORM_ADMIN"] })(
  async (request) => {
    const sp = new URL(request.url).searchParams
    const businessId = sp.get("businessId")
    if (!businessId) return NextResponse.json({ success: false, error: "businessId required" }, { status: 400 })

    const business = await db.business.findUnique({
      where: { id: businessId },
      select: {
        id: true, name: true, slug: true, businessType: true, productCode: true, status: true, isOnline: true,
        _count: { select: { categories: true, products: true, stores: true } },
      },
    })
    if (!business) return NextResponse.json({ success: false, error: "Business not found" }, { status: 404 })

    const storeId = sp.get("storeId")
    // Live catalogue counts as the storefront APIs would see them (ACTIVE only).
    const [activeCategories, activeProducts] = await Promise.all([
      db.category.count({ where: { businessId, isActive: true } }),
      db.product.count({ where: { businessId, status: "ACTIVE" } }),
    ])

    const cfg = getBusinessTypeConfig(business.businessType)
    const template = await resolveTemplateForBusiness({
      businessId, storeId, businessCategory: business.businessType, workspaceType: business.productCode || "COMMERCE",
    })

    return NextResponse.json({
      success: true,
      diagnostic: {
        business: {
          id: business.id, name: business.name, slug: business.slug, status: business.status, isOnline: business.isOnline,
          workspaceType: business.productCode, businessCategory: business.businessType,
        },
        catalogue: {
          totalCategories: business._count.categories, activeCategories,
          totalProducts: business._count.products, activeProducts,
          stores: business._count.stores,
          // The specific empty-state condition the storefront would hit.
          wouldRenderEmptyCategories: activeCategories === 0,
          wouldRenderEmptyProducts: activeProducts === 0,
        },
        presentation: {
          // Proof the Grocery coupling is gone: ECOMMERCE now resolves to the
          // neutral Commerce config, not Grocery.
          resolvedConfigType: cfg.type,
          displayName: cfg.displayName,
          searchPlaceholder: cfg.labels.searchPlaceholder,
          isGroceryCoupled: cfg.type === "GROCERY" && business.businessType !== "GROCERY",
        },
        template: {
          templateId: template.templateId, code: template.code, source: template.source,
          note: "Template engine Phase 1 — no master templates seeded yet; FALLBACK is the neutral Commerce baseline (never Grocery).",
        },
      },
    })
  },
)
