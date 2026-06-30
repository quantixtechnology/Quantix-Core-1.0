// Default Laundry Templates — curated, industry-standard master data so a new
// laundry business can load hundreds of garments / categories / services in one
// click instead of typing them in. Used by the Bulk Import API and the master
// "Load Templates" action. Garments reference categories by name; the importer
// links them and dedupes by name (case-insensitive), so re-running is safe.

export interface TemplateCategory {
  name: string
  code: string
  color: string
  defaultGstPercent?: number
  displayOrder: number
}

export interface TemplateService {
  name: string
  code: string
  category?: string
  defaultPricingType: string
  defaultTurnaroundHours: number
  expressAvailable?: boolean
  subscriptionEligible?: boolean
  displayOrder: number
}

export interface TemplateGarment {
  name: string
  code: string
  category: string
  defaultUnit: string // PIECE | KG
  averageWeight?: number
  material?: string
  displayOrder: number
}

export interface LaundryTemplate {
  id: string
  label: string
  description: string
  categories: TemplateCategory[]
  services: TemplateService[]
  garments: TemplateGarment[]
}

const CATEGORIES: TemplateCategory[] = [
  { name: "Laundry", code: "LND", color: "#0EA5E9", defaultGstPercent: 18, displayOrder: 1 },
  { name: "Dry Clean", code: "DRY", color: "#8B5CF6", defaultGstPercent: 18, displayOrder: 2 },
  { name: "Premium", code: "PRM", color: "#F59E0B", defaultGstPercent: 18, displayOrder: 3 },
  { name: "Ethnic Wear", code: "ETH", color: "#EC4899", defaultGstPercent: 18, displayOrder: 4 },
  { name: "Household", code: "HSE", color: "#10B981", defaultGstPercent: 18, displayOrder: 5 },
  { name: "Footwear & Bags", code: "FWB", color: "#EF4444", defaultGstPercent: 18, displayOrder: 6 },
  { name: "Specialty", code: "SPC", color: "#6366F1", defaultGstPercent: 18, displayOrder: 7 },
]

const SERVICES: TemplateService[] = [
  { name: "Wash & Fold", code: "WF", category: "Laundry", defaultPricingType: "PER_KG", defaultTurnaroundHours: 24, subscriptionEligible: true, displayOrder: 1 },
  { name: "Wash & Iron", code: "WI", category: "Laundry", defaultPricingType: "PER_PIECE", defaultTurnaroundHours: 24, subscriptionEligible: true, displayOrder: 2 },
  { name: "Steam Iron", code: "SI", category: "Laundry", defaultPricingType: "PER_PIECE", defaultTurnaroundHours: 12, expressAvailable: true, displayOrder: 3 },
  { name: "Dry Clean", code: "DC", category: "Dry Clean", defaultPricingType: "PER_PIECE", defaultTurnaroundHours: 48, expressAvailable: true, displayOrder: 4 },
  { name: "Premium Wash", code: "PW", category: "Premium", defaultPricingType: "PER_PIECE", defaultTurnaroundHours: 48, displayOrder: 5 },
  { name: "Shoe Cleaning", code: "SC", category: "Footwear & Bags", defaultPricingType: "FIXED", defaultTurnaroundHours: 72, displayOrder: 6 },
  { name: "Carpet Cleaning", code: "CC", category: "Household", defaultPricingType: "PER_KG", defaultTurnaroundHours: 72, displayOrder: 7 },
  { name: "Stain Removal", code: "SR", category: "Specialty", defaultPricingType: "FIXED", defaultTurnaroundHours: 48, displayOrder: 8 },
]

const G = (name: string, code: string, category: string, unit = "PIECE", averageWeight?: number, material?: string): TemplateGarment =>
  ({ name, code, category, defaultUnit: unit, averageWeight, material, displayOrder: 0 })

const GARMENTS: TemplateGarment[] = [
  // Laundry / everyday
  G("Shirt", "G-SHRT", "Laundry", "PIECE", 0.2, "Cotton"),
  G("T-Shirt", "G-TSHT", "Laundry", "PIECE", 0.18, "Cotton"),
  G("Pant", "G-PANT", "Laundry", "PIECE", 0.4),
  G("Jeans", "G-JEAN", "Laundry", "PIECE", 0.6, "Denim"),
  G("Trouser", "G-TROU", "Laundry", "PIECE", 0.35),
  G("Shorts", "G-SHRT2", "Laundry", "PIECE", 0.2),
  G("Undergarments", "G-UNDR", "Laundry", "PIECE", 0.05),
  G("Socks (pair)", "G-SOCK", "Laundry", "PIECE", 0.05),
  G("Towel", "G-TOWL", "Laundry", "PIECE", 0.3, "Cotton"),
  G("Mixed Wash", "G-MIX", "Laundry", "KG", 1),
  // Dry clean / formal
  G("Blazer", "G-BLZR", "Dry Clean", "PIECE", 0.8, "Wool"),
  G("Suit (2pc)", "G-SUIT", "Dry Clean", "PIECE", 1.2, "Wool"),
  G("Safari Suit", "G-SAFR", "Dry Clean", "PIECE", 1),
  G("Waist Coat", "G-WSTC", "Dry Clean", "PIECE", 0.4),
  G("Tie", "G-TIE", "Dry Clean", "PIECE", 0.05, "Silk"),
  G("Overcoat", "G-OVRC", "Dry Clean", "PIECE", 1.5, "Wool"),
  G("Sweater", "G-SWTR", "Dry Clean", "PIECE", 0.5, "Wool"),
  G("Jacket", "G-JCKT", "Dry Clean", "PIECE", 0.9),
  // Ethnic
  G("Kurta", "G-KURT", "Ethnic Wear", "PIECE", 0.3),
  G("Sherwani", "G-SHRW", "Ethnic Wear", "PIECE", 1.2, "Silk"),
  G("Saree", "G-SARE", "Ethnic Wear", "PIECE", 0.5),
  G("Silk Saree", "G-SLKS", "Ethnic Wear", "PIECE", 0.5, "Silk"),
  G("Cotton Saree", "G-CTNS", "Ethnic Wear", "PIECE", 0.5, "Cotton"),
  G("Lehenga", "G-LEHN", "Ethnic Wear", "PIECE", 1.5),
  G("Dupatta", "G-DUPT", "Ethnic Wear", "PIECE", 0.2),
  G("Salwar Kameez", "G-SLWR", "Ethnic Wear", "PIECE", 0.5),
  // Household
  G("Bedsheet (Single)", "G-BDS1", "Household", "PIECE", 0.6, "Cotton"),
  G("Bedsheet (Double)", "G-BDS2", "Household", "PIECE", 1, "Cotton"),
  G("Blanket", "G-BLKT", "Household", "PIECE", 2),
  G("Quilt", "G-QULT", "Household", "PIECE", 2.5),
  G("Comforter", "G-CMFT", "Household", "PIECE", 2.5),
  G("Pillow Cover", "G-PLWC", "Household", "PIECE", 0.15),
  G("Curtain (per panel)", "G-CRTN", "Household", "PIECE", 1),
  G("Door Mat", "G-DRMT", "Household", "PIECE", 0.8),
  G("Carpet", "G-CRPT", "Household", "KG", 1),
  // Footwear & bags
  G("Shoe (pair)", "G-SHOE", "Footwear & Bags", "PIECE", 0.8),
  G("Sneakers (pair)", "G-SNKR", "Footwear & Bags", "PIECE", 0.7),
  G("Bag", "G-BAG", "Footwear & Bags", "PIECE", 0.6),
  G("Helmet", "G-HLMT", "Footwear & Bags", "PIECE", 1.2),
  // Specialty
  G("Soft Toy", "G-TOY", "Specialty", "PIECE", 0.5),
  G("Leather Jacket", "G-LTHR", "Specialty", "PIECE", 1.2, "Leather"),
]

export const LAUNDRY_TEMPLATES: LaundryTemplate[] = [
  {
    id: "STANDARD",
    label: "Standard Indian Laundry",
    description: "7 categories, 8 services and 40+ common garments — a complete starting point for a typical laundry & dry-clean business.",
    categories: CATEGORIES,
    services: SERVICES,
    garments: GARMENTS,
  },
]

export function getTemplate(id: string): LaundryTemplate | null {
  return LAUNDRY_TEMPLATES.find((t) => t.id === id) || null
}
