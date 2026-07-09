// Commerce storefront SECTION REGISTRY (single source of truth).
//
// The visual page builder AND the storefront renderer both derive from this one
// registry so their configuration contracts never drift. Each definition
// declares its type, label, icon, default config, and — critically — whether it
// is catalogue/data-driven (Category/Product sections) vs. static/content.
//
// Phase 1 defines the registry + contracts. The concrete React renderers land
// in Phase 3 (storefront section renderer) and the builder palette in Phase 4;
// both import from here.

export type SectionCategory = "STRUCTURE" | "CATALOGUE" | "CONTENT" | "MEDIA" | "MARKETING"

// Where a catalogue section pulls its live data from. NEVER stores copied
// product/category data — only the source descriptor. The storefront resolves
// the actual records for the current tenant/store at render time.
export type CategoryDataMode = "ALL_ACTIVE_CATEGORIES" | "SELECTED_CATEGORIES"
export type ProductDataMode = "ALL" | "CATEGORY" | "FEATURED" | "NEW_ARRIVALS" | "BEST_SELLERS" | "MANUAL"

export interface CategoryDataSource {
  mode: CategoryDataMode
  selectedCategoryIds?: string[]
  maxItems?: number
}
export interface ProductDataSource {
  mode: ProductDataMode
  categoryId?: string
  selectedProductIds?: string[]
  maxItems?: number
}

export interface SectionDef {
  type: string
  label: string
  icon: string // lucide icon name (builder palette)
  category: SectionCategory
  // Catalogue sections are data-driven and MUST remain responsive (never
  // absolute-positioned). Content/media sections may support free-form layout.
  dataDriven: boolean
  // Data source shape this section consumes, if any.
  dataSource?: "CATEGORY" | "PRODUCT"
  // Sensible default config the builder seeds a new instance with.
  defaultConfig: {
    layoutConfig?: Record<string, unknown>
    styleConfig?: Record<string, unknown>
    visibilityConfig?: Record<string, unknown>
    dataSourceConfig?: Record<string, unknown>
    contentConfig?: Record<string, unknown>
  }
  // Free-form absolute positioning allowed inside this section (hero/promo only).
  allowsFreeform?: boolean
}

const responsiveVisibility = { desktop: true, tablet: true, mobile: true }

export const COMMERCE_SECTION_REGISTRY: Record<string, SectionDef> = {
  HEADER: {
    type: "HEADER", label: "Header", icon: "PanelTop", category: "STRUCTURE", dataDriven: false,
    defaultConfig: {
      visibilityConfig: responsiveVisibility,
      contentConfig: { showSearch: true, showCategoryMenu: true, showCart: true, showAccount: true, sticky: true },
      styleConfig: { background: "surface", height: 64, alignment: "space-between" },
    },
  },
  HERO: {
    type: "HERO", label: "Hero", icon: "Image", category: "MARKETING", dataDriven: false, allowsFreeform: true,
    defaultConfig: {
      visibilityConfig: responsiveVisibility,
      contentConfig: { heading: "Welcome", subheading: "", ctaText: "Shop Now", ctaHref: "/products", overlay: 0.2, contentAlignment: "center" },
      layoutConfig: { height: 420, imageFit: "cover", imagePosition: "center", width: "full" },
    },
  },
  CATEGORY_GRID: {
    type: "CATEGORY_GRID", label: "Category Grid", icon: "LayoutGrid", category: "CATALOGUE", dataDriven: true, dataSource: "CATEGORY",
    defaultConfig: {
      visibilityConfig: responsiveVisibility,
      dataSourceConfig: { mode: "ALL_ACTIVE_CATEGORIES", maxItems: 12 },
      layoutConfig: { columns: 4, mobileColumns: 2, imageShape: "rounded", showName: true, gap: 16 },
    },
  },
  CATEGORY_CAROUSEL: {
    type: "CATEGORY_CAROUSEL", label: "Category Carousel", icon: "GalleryHorizontal", category: "CATALOGUE", dataDriven: true, dataSource: "CATEGORY",
    defaultConfig: {
      visibilityConfig: responsiveVisibility,
      dataSourceConfig: { mode: "ALL_ACTIVE_CATEGORIES", maxItems: 16 },
      layoutConfig: { imageShape: "circle", showName: true },
    },
  },
  PRODUCT_GRID: {
    type: "PRODUCT_GRID", label: "Product Grid", icon: "Grid3x3", category: "CATALOGUE", dataDriven: true, dataSource: "PRODUCT",
    defaultConfig: {
      visibilityConfig: responsiveVisibility,
      dataSourceConfig: { mode: "FEATURED", maxItems: 8 },
      layoutConfig: { columns: 4, mobileColumns: 2, cardStyle: "standard", imageRatio: "1:1", showName: true, showPrice: true, showDiscount: true, showAddToCart: true },
    },
  },
  PRODUCT_CAROUSEL: {
    type: "PRODUCT_CAROUSEL", label: "Product Carousel", icon: "GalleryHorizontalEnd", category: "CATALOGUE", dataDriven: true, dataSource: "PRODUCT",
    defaultConfig: {
      visibilityConfig: responsiveVisibility,
      dataSourceConfig: { mode: "NEW_ARRIVALS", maxItems: 12 },
      layoutConfig: { cardStyle: "compact", imageRatio: "1:1", showPrice: true },
    },
  },
  OFFER_BANNER: {
    type: "OFFER_BANNER", label: "Offer Banner", icon: "BadgePercent", category: "MARKETING", dataDriven: false,
    defaultConfig: { visibilityConfig: responsiveVisibility, contentConfig: { heading: "Special Offer", ctaText: "Grab Now", ctaHref: "/offers" } },
  },
  IMAGE_BANNER: {
    type: "IMAGE_BANNER", label: "Image Banner", icon: "ImagePlus", category: "MEDIA", dataDriven: false, allowsFreeform: true,
    defaultConfig: { visibilityConfig: responsiveVisibility, layoutConfig: { width: "full", imageFit: "cover", borderRadius: 0 }, contentConfig: { href: "" } },
  },
  IMAGE_GRID: {
    type: "IMAGE_GRID", label: "Image Grid", icon: "LayoutPanelTop", category: "MEDIA", dataDriven: false,
    defaultConfig: { visibilityConfig: responsiveVisibility, layoutConfig: { columns: 3, gap: 12 }, contentConfig: { images: [] } },
  },
  TEXT_BLOCK: {
    type: "TEXT_BLOCK", label: "Text", icon: "Type", category: "CONTENT", dataDriven: false,
    defaultConfig: { visibilityConfig: responsiveVisibility, contentConfig: { html: "<p>Text block</p>", alignment: "left" } },
  },
  CTA: {
    type: "CTA", label: "Button / CTA", icon: "MousePointerClick", category: "MARKETING", dataDriven: false,
    defaultConfig: { visibilityConfig: responsiveVisibility, contentConfig: { text: "Learn More", href: "#", variant: "primary" } },
  },
  PROMO_SECTION: {
    type: "PROMO_SECTION", label: "Promo Section", icon: "Megaphone", category: "MARKETING", dataDriven: false, allowsFreeform: true,
    defaultConfig: { visibilityConfig: responsiveVisibility, layoutConfig: { minHeight: 300 }, contentConfig: { elements: [] } },
  },
  VIDEO: {
    type: "VIDEO", label: "Video", icon: "Video", category: "MEDIA", dataDriven: false,
    defaultConfig: { visibilityConfig: responsiveVisibility, contentConfig: { url: "" } },
  },
  TESTIMONIAL: {
    type: "TESTIMONIAL", label: "Testimonials", icon: "Quote", category: "CONTENT", dataDriven: false,
    defaultConfig: { visibilityConfig: responsiveVisibility, contentConfig: { items: [] } },
  },
  NEWSLETTER: {
    type: "NEWSLETTER", label: "Newsletter", icon: "Mail", category: "MARKETING", dataDriven: false,
    defaultConfig: { visibilityConfig: responsiveVisibility, contentConfig: { heading: "Stay in the loop", placeholder: "Your email" } },
  },
  FOOTER: {
    type: "FOOTER", label: "Footer", icon: "PanelBottom", category: "STRUCTURE", dataDriven: false,
    defaultConfig: { visibilityConfig: responsiveVisibility, contentConfig: { columns: [], showSocial: true } },
  },
  CUSTOM: {
    type: "CUSTOM", label: "Custom Section", icon: "SquareDashed", category: "CONTENT", dataDriven: false, allowsFreeform: true,
    defaultConfig: { visibilityConfig: responsiveVisibility, contentConfig: {} },
  },
}

export const SECTION_TYPES = Object.keys(COMMERCE_SECTION_REGISTRY)
export const getSectionDef = (type: string): SectionDef | undefined => COMMERCE_SECTION_REGISTRY[type]
export const isCatalogueSection = (type: string): boolean => !!COMMERCE_SECTION_REGISTRY[type]?.dataDriven

// Builder palette grouping.
export function sectionsByCategory(): Record<SectionCategory, SectionDef[]> {
  const out = { STRUCTURE: [], CATALOGUE: [], CONTENT: [], MEDIA: [], MARKETING: [] } as Record<SectionCategory, SectionDef[]>
  for (const def of Object.values(COMMERCE_SECTION_REGISTRY)) out[def.category].push(def)
  return out
}
