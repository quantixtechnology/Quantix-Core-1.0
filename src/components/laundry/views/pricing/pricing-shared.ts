// Shared types, constants and helpers for the Pricing Engine UI.

export const NONE = "__none__"

export const PRICING_TYPES = ["PER_PIECE", "PER_KG", "FIXED", "CORPORATE", "SUBSCRIPTION"] as const
export const CUSTOMER_TYPES = ["WALK_IN", "PICKUP", "CORPORATE", "HOTEL", "HOSPITAL", "SUBSCRIPTION", "VIP"] as const
export const STATUSES = ["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"] as const
export type RuleStatus = (typeof STATUSES)[number]

export const typeLabel = (t?: string | null) =>
  (t || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())

export const inr = (n: number | null | undefined) =>
  n == null ? "—" : `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`

export interface Ref { id: string; name?: string; storeName?: string; categoryId?: string | null }

// Human-readable priority band. The Billing Resolver uses the numeric value; this
// label is display-only (ranges: 0–24 Normal, 25–49 Preferred, 50–74 High,
// 75–99 Override, 100 Highest).
export const priorityLabel = (n: number | null | undefined): string => {
  const v = Number(n) || 0
  if (v >= 100) return "Highest"
  if (v >= 75) return "Override"
  if (v >= 50) return "High"
  if (v >= 25) return "Preferred"
  return "Normal"
}

export interface Rule {
  id: string
  name: string | null
  description: string | null
  notes: string | null
  pricingType: string
  price: number
  gstPercent: number
  priority: number
  status: string
  isActive: boolean
  customerType: string | null
  service?: Ref | null
  garment?: Ref | null
  category?: Ref | null
  store?: (Ref & { storeName?: string }) | null
  serviceId?: string | null
  garmentId?: string | null
  categoryId?: string | null
  storeId?: string | null
  minCharge: number | null
  maxCharge: number | null
  minWeightKg: number | null
  maxWeightKg: number | null
  extraWeightCharge: number | null
  includedPieces: number | null
  discountPercent: number | null
  weekendPrice: number | null
  expressCharge: number | null
  pickupCharge: number | null
  deliveryCharge: number | null
  hsnCode: string | null
  effectiveFrom: string | null
  effectiveTo: string | null
  version: number
  createdByName: string | null
  modifiedByName: string | null
  createdAt: string
  updatedAt: string
}

export interface RuleAudit {
  id: string
  version: number
  action: string
  actorName: string | null
  createdAt: string
}

export const statusBadgeClass = (status: string) => {
  switch (status) {
    case "ACTIVE": return "border-emerald-300 text-emerald-700 bg-emerald-50"
    case "DRAFT": return "border-amber-300 text-amber-700 bg-amber-50"
    case "INACTIVE": return "border-gray-300 text-gray-500 bg-gray-50"
    case "ARCHIVED": return "border-slate-300 text-slate-500 bg-slate-100"
    default: return "border-gray-200 text-gray-400"
  }
}

// Which pricing fields are relevant for each pricing type (drives the wizard).
export interface FieldSpec { key: string; label: string; int?: boolean }
export function priceFieldsFor(pricingType: string): FieldSpec[] {
  switch (pricingType) {
    case "PER_KG":
      return [
        { key: "price", label: "Price per KG (₹)" },
        { key: "minWeightKg", label: "Minimum Weight (KG)" },
        { key: "maxWeightKg", label: "Maximum Weight (KG)" },
        { key: "extraWeightCharge", label: "Extra Weight Charge (₹/KG)" },
      ]
    case "SUBSCRIPTION":
      return [
        { key: "maxWeightKg", label: "Included KG" },
        { key: "includedPieces", label: "Included Pieces", int: true },
        { key: "extraWeightCharge", label: "Excess Rate (₹/KG)" },
      ]
    case "CORPORATE":
      return [
        { key: "price", label: "Flat Rate (₹)" },
        { key: "discountPercent", label: "Discount %" },
      ]
    case "FIXED":
      return [{ key: "price", label: "Fixed Price (₹)" }]
    case "PER_PIECE":
    default:
      return [{ key: "price", label: "Price per Piece (₹)" }]
  }
}

// Scope in pricing hierarchy order: Service › Category › Garment, with the
// customer/store scope appended when set. Category/Garment fall back to
// "All Categories" / "All Garments" so the hierarchy reads correctly (Category
// is NOT the garment). e.g. "Wash & Iron · Women · Pant", "Wash · All
// Categories · All Garments", "Dry Clean · Men · All Garments".
export const scopeSummary = (r: Pick<Rule, "service" | "garment" | "category" | "store" | "customerType">) => {
  const svc = r.service?.name, cat = r.category?.name, grm = r.garment?.name
  const extra = [r.customerType && typeLabel(r.customerType), r.store?.storeName].filter(Boolean)
  if (!svc && !cat && !grm && extra.length === 0) return "All (generic)"
  const core = [svc || "All Services", cat || "All Categories", grm || "All Garments"].join(" · ")
  return extra.length ? `${core} · ${extra.join(" · ")}` : core
}
