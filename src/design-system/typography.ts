// ============================================================================
// Design System — Typography
//
// Tailwind class strings for every recurring text role in the storefront.
// Components import the exact token they need instead of writing raw classes.
// ============================================================================

export const TYPE = {
  // ── Section headings ──────────────────────────────────────────────────
  SECTION_TITLE: "text-xl font-bold text-gray-900",
  SECTION_SUB:   "text-sm text-gray-500 mt-0.5",

  // ── Card text ─────────────────────────────────────────────────────────
  CARD_NAME:     "text-xs font-semibold text-gray-900 truncate",
  CARD_VARIANT:  "text-xs text-gray-400 mt-0.5 truncate",
  CARD_DESC:     "text-xs text-gray-500 mt-0.5 line-clamp-1",
  PRICE_MAIN:    "text-sm font-bold",
  PRICE_STRIKE:  "text-xs text-gray-400 line-through ml-1",

  // ── Badge labels ──────────────────────────────────────────────────────
  BADGE:         "text-[9px] font-bold px-1.5 py-0.5 rounded-full",

  // ── Empty & error states ──────────────────────────────────────────────
  EMPTY_TITLE:   "text-base font-semibold text-gray-500",
  EMPTY_SUB:     "text-sm text-gray-400",

  // ── Navigation / links ────────────────────────────────────────────────
  VIEW_ALL:      "text-sm font-semibold flex items-center gap-1 hover:opacity-80 transition-opacity",
  NAV_LABEL:     "text-xs font-medium text-gray-700 text-center leading-tight line-clamp-2",

  // ── Banner ────────────────────────────────────────────────────────────
  BANNER_TITLE:  "text-lg sm:text-2xl font-bold text-white leading-tight",
  BANNER_SUB:    "text-sm text-white/80 mt-1",
} as const
