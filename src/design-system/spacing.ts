// ============================================================================
// Design System — Spacing
//
// Consistent spatial rhythm for all storefront components.
// Token names map to the Tailwind scale but are expressed as plain numbers
// so components can use them in both Tailwind classes and inline styles.
// ============================================================================

export const SPACING = {
  1:  4,
  2:  8,
  3:  12,
  4:  16,
  5:  20,
  6:  24,
  8:  32,
  10: 40,
  12: 48,
  16: 64,
} as const

// ── Common Tailwind class bundles ─────────────────────────────────────────
// Use these instead of repeating the same class strings everywhere.

/** Standard horizontal page padding responsive to screen width */
export const PAGE_X = "px-4 sm:px-6 lg:px-8"

/** Inner padding for all product cards */
export const CARD_INNER = "p-2"

/** Vertical padding for full-width home sections */
export const SECTION_Y = "py-10"

/** Gap between product cards in a grid */
export const GRID_GAP = "gap-2"

/** Gap between category tiles */
export const CAT_GAP = "gap-4"

/** Responsive product grid column counts */
export const PRODUCT_GRID = "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"

/** Responsive category grid */
export const CATEGORY_GRID = "grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8"

// ── Mobile PWA tokens ────────────────────────────────────────────────────

/** Height of the fixed bottom navigation bar (px) */
export const BOTTOM_NAV_H = 64

/** Height of the floating cart bar that appears above the bottom nav (px) */
export const CART_BAR_H = 68

/** Content padding-bottom when bottom nav is visible (no cart bar) */
export const MOBILE_PB_NAV = `pb-16`

/** Content padding-bottom when both bottom nav + cart bar are visible */
export const MOBILE_PB_CART = `pb-[132px]`
