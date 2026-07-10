// Canonical Commerce business-category vocabulary. These are the subset of the
// Prisma BusinessType enum that are valid for productCode=COMMERCE storefronts —
// the authoritative category the template resolver keys off (Business.businessType).
// No competing businessCategory field exists; this is a controlled view over the
// existing enum. Do NOT add values that are not in prisma enum BusinessType.
export interface CommerceCategoryDef {
  value: string // must be a BusinessType enum value
  label: string // human-readable UI label
  description: string
}

export const COMMERCE_BUSINESS_CATEGORIES: CommerceCategoryDef[] = [
  { value: "GROCERY", label: "Grocery", description: "Daily grocery & essentials" },
  { value: "MEAT_DELIVERY", label: "Meat Delivery", description: "Fresh meat, poultry & seafood" },
  { value: "ECOMMERCE", label: "General E-Commerce", description: "Category-agnostic online store" },
  { value: "COSMETICS", label: "Cosmetics", description: "Beauty & personal care" },
  { value: "FURNITURE", label: "Furniture", description: "Furniture & home furnishing" },
  { value: "FOOD_DELIVERY", label: "Food Delivery", description: "Restaurant & prepared food" },
  { value: "PHARMACY", label: "Pharmacy", description: "Medicines & wellness" },
]

const BY_VALUE = new Map(COMMERCE_BUSINESS_CATEGORIES.map((c) => [c.value, c]))

export const COMMERCE_CATEGORY_VALUES: string[] = COMMERCE_BUSINESS_CATEGORIES.map((c) => c.value)

export function isCommerceCategory(value: string): boolean {
  return BY_VALUE.has(value)
}

export function commerceCategoryLabel(value: string | null | undefined): string {
  if (!value) return "—"
  return BY_VALUE.get(value)?.label ?? value.replace(/_/g, " ")
}
