// ============================================================================
// BUSINESS TYPE CONFIGURATION ENGINE
// Central config that drives UI, filters, metadata, checkout, and delivery
// behaviour per business type — without any code duplication.
//
// How it works:
//   1. store-context API returns businessType
//   2. getBusinessTypeConfig(type) returns the full config for that type
//   3. Components (home, products, checkout, cart) read from this config
//   4. Adding a new business type = add one entry below, nothing else changes
// ============================================================================

export type SupportedBusinessType =
  | "MEAT_DELIVERY"
  | "GROCERY"
  | "FOOD_DELIVERY"
  | "PHARMACY"
  | "LAUNDRY"
  | "HOME_SERVICES"
  | string // fallback for unknown types stored in DB

// ── Product Filters ────────────────────────────────────────────────────────

export interface FilterOption {
  value: string
  label: string
}

export interface ProductFilter {
  id: string
  label: string
  type: "toggle" | "checkbox" | "range"
  metaKey?: string        // filter by metadata JSON field
  options?: FilterOption[]
  min?: number            // for range type
  max?: number
  step?: number
  unit?: string
}

// ── Product Metadata Schema ────────────────────────────────────────────────

export interface MetaField {
  key: string
  label: string
  type: "pills" | "toggle" | "tags"
  options?: string[]
  showOnDetail?: boolean   // show in product detail page
  showOnCard?: boolean     // show as badge on product card
}

// ── Home Page Blocks ───────────────────────────────────────────────────────

export type HomeBlockType =
  | "hero"
  | "delivery_promise"
  | "categories"
  | "featured"
  | "offers"
  | "best_sellers"
  | "recently_added"
  | "footer"

export interface HomeBlock {
  id: HomeBlockType
  order: number
  enabled: boolean
}

// ── Checkout Options ───────────────────────────────────────────────────────

export interface CheckoutOptions {
  showCutType: boolean        // MEAT_DELIVERY
  showCleaning: boolean       // MEAT_DELIVERY
  showMarinade: boolean       // MEAT_DELIVERY
  showPrescription: boolean   // PHARMACY
  showServiceDateTime: boolean // LAUNDRY, HOME_SERVICES
  showPieces: boolean         // MEAT_DELIVERY (whole bird count)
  showWeight: boolean         // MEAT_DELIVERY, GROCERY
  deliverySlotRequired: boolean
  expressAvailable: boolean
}

// ── Delivery Config ────────────────────────────────────────────────────────

export interface DeliveryConfig {
  promiseHeadline: string     // "45–90 min delivery"
  promiseSubtext: string      // "Fresh to your door"
  hasTracking: boolean
  hasLiveLocation: boolean
  scheduledDelivery: boolean
  slotsPerDay: number
}

// ── UI Labels ─────────────────────────────────────────────────────────────

export interface BusinessLabels {
  addToCart: string
  buyNow: string
  emptyCart: string
  noProducts: string
  searchPlaceholder: string
  categoryHeading: string
  featuredHeading: string
  bestSellersHeading: string
  recentHeading: string
  unitLabel: string          // "500g", "1 piece", "1 session"
}

// ── Full Config ────────────────────────────────────────────────────────────

export interface BusinessTypeConfig {
  type: SupportedBusinessType
  displayName: string
  emoji: string
  productFilters: ProductFilter[]
  productMeta: MetaField[]
  homeBlocks: HomeBlock[]
  checkoutOptions: CheckoutOptions
  deliveryConfig: DeliveryConfig
  labels: BusinessLabels
  defaultCategoryIcons: Record<string, string>
}

// ============================================================================
// CONFIG DEFINITIONS
// ============================================================================

const MEAT_DELIVERY_CONFIG: BusinessTypeConfig = {
  type: "MEAT_DELIVERY",
  displayName: "Meat & Poultry",
  emoji: "🍗",

  productFilters: [
    { id: "availability", label: "In Stock", type: "toggle" },
    { id: "fresh_today",  label: "Fresh Today", type: "toggle", metaKey: "freshnessTag" },
    { id: "halal",        label: "Halal", type: "toggle", metaKey: "isHalal" },
    { id: "boneless",     label: "Boneless", type: "toggle", metaKey: "cutTypes" },
    {
      id: "cut_type",
      label: "Cut Type",
      type: "checkbox",
      metaKey: "cutTypes",
      options: [
        { value: "curry_cut", label: "Curry Cut" },
        { value: "boneless",  label: "Boneless" },
        { value: "whole",     label: "Whole" },
        { value: "keema",     label: "Keema" },
      ],
    },
    {
      id: "marinade",
      label: "Marinade",
      type: "checkbox",
      metaKey: "marinade",
      options: [
        { value: "tandoori", label: "Tandoori" },
        { value: "lemon",    label: "Lemon Herb" },
        { value: "none",     label: "No Marinade" },
      ],
    },
    {
      id: "price",
      label: "Price",
      type: "range",
      min: 0,
      max: 2000,
      step: 50,
      unit: "₹",
    },
  ],

  productMeta: [
    { key: "freshnessTag", label: "Freshness",      type: "tags",  showOnCard: true,  showOnDetail: true },
    { key: "isHalal",      label: "Halal",          type: "toggle",showOnCard: true,  showOnDetail: true },
    { key: "cutTypes",     label: "Cut Types",      type: "pills", showOnCard: false, showOnDetail: true, options: ["Whole", "Curry Cut", "Boneless", "Keema"] },
    { key: "cleaningOptions", label: "Cleaning",    type: "pills", showOnCard: false, showOnDetail: true, options: ["Full Clean", "Without Skin", "With Skin"] },
    { key: "marinade",     label: "Marinade",       type: "pills", showOnCard: false, showOnDetail: true, options: ["Tandoori", "Lemon Herb", "Plain"] },
    { key: "isOrganic",    label: "Organic",        type: "toggle",showOnCard: true,  showOnDetail: true },
  ],

  homeBlocks: [
    { id: "hero",             order: 1, enabled: true  },
    { id: "delivery_promise", order: 2, enabled: true  },
    { id: "categories",       order: 3, enabled: true  },
    { id: "offers",           order: 4, enabled: true  },
    { id: "featured",         order: 5, enabled: true  },
    { id: "best_sellers",     order: 6, enabled: true  },
    { id: "recently_added",   order: 7, enabled: true  },
    { id: "footer",           order: 8, enabled: true  },
  ],

  checkoutOptions: {
    showCutType: true,
    showCleaning: true,
    showMarinade: true,
    showPrescription: false,
    showServiceDateTime: false,
    showPieces: true,
    showWeight: true,
    deliverySlotRequired: false,
    expressAvailable: true,
  },

  deliveryConfig: {
    promiseHeadline: "45–90 min delivery",
    promiseSubtext: "Fresh & hygienically packed",
    hasTracking: true,
    hasLiveLocation: true,
    scheduledDelivery: true,
    slotsPerDay: 5,
  },

  labels: {
    addToCart: "Add to Cart",
    buyNow: "Buy Now",
    emptyCart: "Your cart is empty",
    noProducts: "No products found",
    searchPlaceholder: "Search chicken, mutton, fish...",
    categoryHeading: "Shop by Category",
    featuredHeading: "Fresh Picks Today",
    bestSellersHeading: "Best Sellers",
    recentHeading: "Newly Stocked",
    unitLabel: "g",
  },

  defaultCategoryIcons: {
    chicken:       "🐔",
    mutton:        "🐑",
    fish:          "🐟",
    seafood:       "🦐",
    eggs:          "🥚",
    "ready to cook": "🍳",
    marinades:     "🫙",
    "cold cuts":   "🥩",
  },
}

const GROCERY_CONFIG: BusinessTypeConfig = {
  type: "GROCERY",
  displayName: "Grocery & Essentials",
  emoji: "🛒",

  productFilters: [
    { id: "availability", label: "In Stock",       type: "toggle" },
    { id: "organic",      label: "Organic",        type: "toggle", metaKey: "isOrganic" },
    { id: "brand",        label: "Brand",          type: "checkbox", options: [] },
    { id: "price",        label: "Price",          type: "range", min: 0, max: 5000, step: 50, unit: "₹" },
  ],

  productMeta: [
    { key: "isOrganic",   label: "Organic",        type: "toggle", showOnCard: true,  showOnDetail: true },
    { key: "brand",       label: "Brand",          type: "tags",   showOnCard: false, showOnDetail: true },
    { key: "netWeight",   label: "Net Weight",     type: "tags",   showOnCard: true,  showOnDetail: true },
    { key: "expiryDate",  label: "Best Before",    type: "tags",   showOnCard: false, showOnDetail: true },
  ],

  homeBlocks: [
    { id: "hero",             order: 1, enabled: true  },
    { id: "delivery_promise", order: 2, enabled: true  },
    { id: "categories",       order: 3, enabled: true  },
    { id: "featured",         order: 4, enabled: true  },
    { id: "offers",           order: 5, enabled: true  },
    { id: "best_sellers",     order: 6, enabled: true  },
    { id: "recently_added",   order: 7, enabled: false },
    { id: "footer",           order: 8, enabled: true  },
  ],

  checkoutOptions: {
    showCutType: false,
    showCleaning: false,
    showMarinade: false,
    showPrescription: false,
    showServiceDateTime: false,
    showPieces: false,
    showWeight: true,
    deliverySlotRequired: false,
    expressAvailable: true,
  },

  deliveryConfig: {
    promiseHeadline: "Express 30-min delivery",
    promiseSubtext: "Groceries at your doorstep",
    hasTracking: true,
    hasLiveLocation: false,
    scheduledDelivery: true,
    slotsPerDay: 4,
  },

  labels: {
    addToCart: "Add",
    buyNow: "Buy Now",
    emptyCart: "Your cart is empty",
    noProducts: "No products found",
    searchPlaceholder: "Search groceries, vegetables, dairy...",
    categoryHeading: "Shop by Category",
    featuredHeading: "Today's Deals",
    bestSellersHeading: "Best Sellers",
    recentHeading: "New Arrivals",
    unitLabel: "qty",
  },

  defaultCategoryIcons: {
    vegetables: "🥦",
    fruits: "🍎",
    dairy: "🥛",
    grains: "🌾",
    snacks: "🍪",
    beverages: "🧃",
    frozen: "🧊",
    household: "🧹",
  },
}

const FOOD_DELIVERY_CONFIG: BusinessTypeConfig = {
  type: "FOOD_DELIVERY",
  displayName: "Food Delivery",
  emoji: "🍽️",

  productFilters: [
    { id: "availability", label: "Available Now",  type: "toggle" },
    { id: "veg",          label: "Veg Only",       type: "toggle", metaKey: "isVeg" },
    { id: "spice",        label: "Spice Level",    type: "checkbox", metaKey: "spiceLevel",
      options: [{ value: "mild", label: "Mild" }, { value: "medium", label: "Medium" }, { value: "hot", label: "Hot" }] },
    { id: "price",        label: "Price",          type: "range", min: 0, max: 1000, step: 25, unit: "₹" },
  ],

  productMeta: [
    { key: "isVeg",       label: "Veg",            type: "toggle", showOnCard: true,  showOnDetail: true },
    { key: "spiceLevel",  label: "Spice Level",    type: "tags",   showOnCard: true,  showOnDetail: true },
    { key: "prepTime",    label: "Prep Time",      type: "tags",   showOnCard: true,  showOnDetail: true },
    { key: "allergens",   label: "Allergens",      type: "tags",   showOnCard: false, showOnDetail: true },
    { key: "calories",    label: "Calories",       type: "tags",   showOnCard: false, showOnDetail: true },
  ],

  homeBlocks: [
    { id: "hero",             order: 1, enabled: true  },
    { id: "delivery_promise", order: 2, enabled: true  },
    { id: "categories",       order: 3, enabled: true  },
    { id: "offers",           order: 4, enabled: true  },
    { id: "featured",         order: 5, enabled: true  },
    { id: "best_sellers",     order: 6, enabled: true  },
    { id: "recently_added",   order: 7, enabled: false },
    { id: "footer",           order: 8, enabled: true  },
  ],

  checkoutOptions: {
    showCutType: false,
    showCleaning: false,
    showMarinade: false,
    showPrescription: false,
    showServiceDateTime: false,
    showPieces: false,
    showWeight: false,
    deliverySlotRequired: false,
    expressAvailable: true,
  },

  deliveryConfig: {
    promiseHeadline: "30–45 min delivery",
    promiseSubtext: "Hot food delivered fast",
    hasTracking: true,
    hasLiveLocation: true,
    scheduledDelivery: false,
    slotsPerDay: 0,
  },

  labels: {
    addToCart: "Add to Order",
    buyNow: "Order Now",
    emptyCart: "Nothing in your order yet",
    noProducts: "Menu item not available",
    searchPlaceholder: "Search biryani, pizza, burgers...",
    categoryHeading: "Our Menu",
    featuredHeading: "Chef's Specials",
    bestSellersHeading: "Most Ordered",
    recentHeading: "New on the Menu",
    unitLabel: "plate",
  },

  defaultCategoryIcons: {
    starters: "🥗",
    mains: "🍛",
    breads: "🫓",
    rice: "🍚",
    beverages: "🥤",
    desserts: "🍨",
    combos: "🍱",
  },
}

const PHARMACY_CONFIG: BusinessTypeConfig = {
  type: "PHARMACY",
  displayName: "Pharmacy",
  emoji: "💊",

  productFilters: [
    { id: "availability",  label: "In Stock",       type: "toggle" },
    { id: "prescription",  label: "OTC Only",       type: "toggle", metaKey: "requiresPrescription" },
    { id: "generic",       label: "Generic",        type: "toggle", metaKey: "isGeneric" },
    { id: "price",         label: "Price",          type: "range", min: 0, max: 5000, step: 10, unit: "₹" },
  ],

  productMeta: [
    { key: "requiresPrescription", label: "Prescription Required", type: "toggle", showOnCard: true,  showOnDetail: true },
    { key: "isGeneric",    label: "Generic",        type: "toggle", showOnCard: false, showOnDetail: true },
    { key: "manufacturer", label: "Manufacturer",   type: "tags",   showOnCard: false, showOnDetail: true },
    { key: "composition",  label: "Composition",    type: "tags",   showOnCard: false, showOnDetail: true },
    { key: "expiryDate",   label: "Expires",        type: "tags",   showOnCard: false, showOnDetail: true },
  ],

  homeBlocks: [
    { id: "hero",             order: 1, enabled: true  },
    { id: "categories",       order: 2, enabled: true  },
    { id: "featured",         order: 3, enabled: true  },
    { id: "offers",           order: 4, enabled: true  },
    { id: "delivery_promise", order: 5, enabled: true  },
    { id: "best_sellers",     order: 6, enabled: false },
    { id: "recently_added",   order: 7, enabled: false },
    { id: "footer",           order: 8, enabled: true  },
  ],

  checkoutOptions: {
    showCutType: false,
    showCleaning: false,
    showMarinade: false,
    showPrescription: true,
    showServiceDateTime: false,
    showPieces: false,
    showWeight: false,
    deliverySlotRequired: false,
    expressAvailable: true,
  },

  deliveryConfig: {
    promiseHeadline: "30-min medicine delivery",
    promiseSubtext: "Licensed pharmacy • Genuine medicines",
    hasTracking: true,
    hasLiveLocation: false,
    scheduledDelivery: false,
    slotsPerDay: 0,
  },

  labels: {
    addToCart: "Add to Cart",
    buyNow: "Order Now",
    emptyCart: "Cart is empty",
    noProducts: "Medicine not found",
    searchPlaceholder: "Search medicines, vitamins...",
    categoryHeading: "Categories",
    featuredHeading: "Health Essentials",
    bestSellersHeading: "Top Selling",
    recentHeading: "New Arrivals",
    unitLabel: "strip",
  },

  defaultCategoryIcons: {
    medicines: "💊",
    vitamins: "🫐",
    "skin care": "🧴",
    "baby care": "👶",
    "personal care": "🪥",
    devices: "🩺",
    "health food": "🥗",
  },
}

const LAUNDRY_CONFIG: BusinessTypeConfig = {
  type: "LAUNDRY",
  displayName: "Laundry & Dry Clean",
  emoji: "👕",

  productFilters: [
    { id: "availability", label: "Available",      type: "toggle" },
    { id: "service_type", label: "Service Type",   type: "checkbox", metaKey: "serviceType",
      options: [
        { value: "wash", label: "Wash" },
        { value: "dry_clean", label: "Dry Clean" },
        { value: "iron", label: "Iron Only" },
      ],
    },
    { id: "price", label: "Price", type: "range", min: 0, max: 500, step: 10, unit: "₹" },
  ],

  productMeta: [
    { key: "serviceType",  label: "Service",        type: "pills",  showOnCard: true,  showOnDetail: true },
    { key: "turnaround",   label: "Turnaround",     type: "tags",   showOnCard: true,  showOnDetail: true },
    { key: "garmentTypes", label: "Garment Types",  type: "tags",   showOnCard: false, showOnDetail: true },
  ],

  homeBlocks: [
    { id: "hero",             order: 1, enabled: true  },
    { id: "delivery_promise", order: 2, enabled: true  },
    { id: "categories",       order: 3, enabled: true  },
    { id: "featured",         order: 4, enabled: true  },
    { id: "offers",           order: 5, enabled: true  },
    { id: "best_sellers",     order: 6, enabled: false },
    { id: "recently_added",   order: 7, enabled: false },
    { id: "footer",           order: 8, enabled: true  },
  ],

  checkoutOptions: {
    showCutType: false,
    showCleaning: false,
    showMarinade: false,
    showPrescription: false,
    showServiceDateTime: true,
    showPieces: false,
    showWeight: false,
    deliverySlotRequired: true,
    expressAvailable: false,
  },

  deliveryConfig: {
    promiseHeadline: "Pickup & deliver in 24h",
    promiseSubtext: "Freshly cleaned to your door",
    hasTracking: true,
    hasLiveLocation: false,
    scheduledDelivery: true,
    slotsPerDay: 3,
  },

  labels: {
    addToCart: "Book Service",
    buyNow: "Book Now",
    emptyCart: "No services added",
    noProducts: "Service not available",
    searchPlaceholder: "Search laundry services...",
    categoryHeading: "Our Services",
    featuredHeading: "Popular Services",
    bestSellersHeading: "Most Booked",
    recentHeading: "New Services",
    unitLabel: "piece",
  },

  defaultCategoryIcons: {
    "wash & fold": "🫧",
    "dry clean": "✨",
    ironing: "🔥",
    "stain removal": "🧹",
    "shoe cleaning": "👟",
  },
}

const HOME_SERVICES_CONFIG: BusinessTypeConfig = {
  type: "HOME_SERVICES",
  displayName: "Home Services",
  emoji: "🏠",

  productFilters: [
    { id: "availability",  label: "Available Today", type: "toggle" },
    { id: "service_type",  label: "Service Type",   type: "checkbox", metaKey: "serviceType",
      options: [
        { value: "cleaning",    label: "Cleaning" },
        { value: "plumbing",    label: "Plumbing" },
        { value: "electrical",  label: "Electrical" },
        { value: "ac_service",  label: "AC Service" },
      ],
    },
    { id: "price", label: "Price", type: "range", min: 0, max: 3000, step: 50, unit: "₹" },
  ],

  productMeta: [
    { key: "serviceType",  label: "Category",       type: "tags",   showOnCard: true,  showOnDetail: true },
    { key: "duration",     label: "Duration",       type: "tags",   showOnCard: true,  showOnDetail: true },
    { key: "teamSize",     label: "Team Size",      type: "tags",   showOnCard: false, showOnDetail: true },
    { key: "includes",     label: "Includes",       type: "tags",   showOnCard: false, showOnDetail: true },
  ],

  homeBlocks: [
    { id: "hero",             order: 1, enabled: true  },
    { id: "categories",       order: 2, enabled: true  },
    { id: "featured",         order: 3, enabled: true  },
    { id: "offers",           order: 4, enabled: true  },
    { id: "delivery_promise", order: 5, enabled: true  },
    { id: "best_sellers",     order: 6, enabled: true  },
    { id: "recently_added",   order: 7, enabled: false },
    { id: "footer",           order: 8, enabled: true  },
  ],

  checkoutOptions: {
    showCutType: false,
    showCleaning: false,
    showMarinade: false,
    showPrescription: false,
    showServiceDateTime: true,
    showPieces: false,
    showWeight: false,
    deliverySlotRequired: true,
    expressAvailable: false,
  },

  deliveryConfig: {
    promiseHeadline: "Book & confirm in 2 min",
    promiseSubtext: "Verified professionals at home",
    hasTracking: true,
    hasLiveLocation: false,
    scheduledDelivery: true,
    slotsPerDay: 6,
  },

  labels: {
    addToCart: "Book Service",
    buyNow: "Book Now",
    emptyCart: "No services added",
    noProducts: "Service not available",
    searchPlaceholder: "Search home services...",
    categoryHeading: "What do you need?",
    featuredHeading: "Top Services",
    bestSellersHeading: "Most Booked",
    recentHeading: "New Services",
    unitLabel: "session",
  },

  defaultCategoryIcons: {
    cleaning: "🧹",
    plumbing: "🔧",
    electrical: "⚡",
    "ac service": "❄️",
    painting: "🖌️",
    carpentry: "🪚",
    pest: "🐜",
  },
}

// ── Default fallback ────────────────────────────────────────────────────────

const DEFAULT_CONFIG: BusinessTypeConfig = {
  ...GROCERY_CONFIG,
  type: "GROCERY",
  displayName: "Store",
  emoji: "🏪",
}

// ============================================================================
// ACCESSOR
// ============================================================================

const CONFIG_MAP: Record<string, BusinessTypeConfig> = {
  MEAT_DELIVERY:  MEAT_DELIVERY_CONFIG,
  GROCERY:        GROCERY_CONFIG,
  FOOD_DELIVERY:  FOOD_DELIVERY_CONFIG,
  PHARMACY:       PHARMACY_CONFIG,
  LAUNDRY:        LAUNDRY_CONFIG,
  HOME_SERVICES:  HOME_SERVICES_CONFIG,
}

export function getBusinessTypeConfig(businessType?: string | null): BusinessTypeConfig {
  if (!businessType) return DEFAULT_CONFIG
  return CONFIG_MAP[businessType] ?? DEFAULT_CONFIG
}

export function getEnabledHomeBlocks(businessType?: string | null): HomeBlock[] {
  return getBusinessTypeConfig(businessType)
    .homeBlocks
    .filter((b) => b.enabled)
    .sort((a, b) => a.order - b.order)
}

export function getProductFilters(businessType?: string | null): ProductFilter[] {
  return getBusinessTypeConfig(businessType).productFilters
}

export function getProductMeta(businessType?: string | null): MetaField[] {
  return getBusinessTypeConfig(businessType).productMeta
}

export function getDeliveryPromise(businessType?: string | null) {
  return getBusinessTypeConfig(businessType).deliveryConfig
}

export function getLabels(businessType?: string | null) {
  return getBusinessTypeConfig(businessType).labels
}

export function getCategoryIcon(businessType: string | null | undefined, categoryName: string): string {
  const icons = getBusinessTypeConfig(businessType).defaultCategoryIcons
  const key = categoryName.toLowerCase()
  for (const [k, icon] of Object.entries(icons)) {
    if (key.includes(k) || k.includes(key)) return icon
  }
  return "📦"
}
