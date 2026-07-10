// Product → Business Category mapping.
//
// Business Category is Business.businessType (the Prisma BusinessType enum). The
// VALID categories depend on the selected Product (Business.productCode /
// PlatformProduct.code). This is the authoritative product-scoped vocabulary the
// Business Setup wizard uses so category can never precede product.
//
// No new businessCategory field is introduced; this only groups existing enum
// values by product.
//
// LAUNDRY category finding (Phase 3 audit): the BusinessType enum exposes a
// single laundry value, LAUNDRY. Laundry store/centre types (RETAIL_STORE,
// PROCESSING_HUB, PICKUP_CENTER, …) are OPERATIONAL LOCATIONS, not the business
// category, and are intentionally NOT reused here. Finer laundry sub-categories
// (dry-cleaning, pickup-&-delivery, laundromat, commercial) would require new
// BusinessType enum values + a schema migration and are deferred to Phase 4.
import { COMMERCE_BUSINESS_CATEGORIES, type CommerceCategoryDef } from "@/lib/commerce/commerce-categories"

export type BusinessCategoryDef = CommerceCategoryDef

// Keyed by PlatformProduct.code. Only products with a defined mapping expose
// categories; unknown/unmapped products yield an empty list (category stays
// unavailable until a supported product is chosen).
export const PRODUCT_BUSINESS_CATEGORIES: Record<string, BusinessCategoryDef[]> = {
  COMMERCE: COMMERCE_BUSINESS_CATEGORIES,
  LAUNDRY: [
    { value: "LAUNDRY", label: "Laundry & Dry Cleaning", description: "Laundry, wash-&-fold and dry cleaning" },
  ],
}

export function getProductCategories(productCode: string | null | undefined): BusinessCategoryDef[] {
  if (!productCode) return []
  return PRODUCT_BUSINESS_CATEGORIES[productCode.toUpperCase()] ?? []
}

export function isCategoryValidForProduct(productCode: string | null | undefined, businessType: string | null | undefined): boolean {
  if (!productCode || !businessType) return false
  return getProductCategories(productCode).some((c) => c.value === businessType)
}
