// ============================================================================
// PWA Appearance — shared types, defaults, and style helpers
//
// All PWA appearance settings live in Business.settings.ecommerceConfig.pwaAppearance.
// No Prisma migration needed — the field is a JSON column.
// Future settings (dark mode, nav style, banner style, etc.) extend PwaAppearance.
// ============================================================================

// ── Types ─────────────────────────────────────────────────────────────────────

/** Background style of the PWA app bar */
export type PwaHeaderTheme = "white" | "brandTint" | "brandColor"

/** Shape of category tiles in PWA scroll strip */
export type PwaCategoryStyle = "rounded" | "circle"

/** Product card layout variant in PWA grid */
export type PwaProductCardStyle = "standard" | "modern"

export interface PwaAppearance {
  headerTheme:      PwaHeaderTheme
  categoryStyle:    PwaCategoryStyle
  productCardStyle: PwaProductCardStyle
  // Future: bottomNavStyle, bannerStyle, headerHeight, darkMode, ...
}

// ── Defaults ─────────────────────────────────────────────────────────────────

export const PWA_APPEARANCE_DEFAULTS: PwaAppearance = {
  headerTheme:      "white",    // white until business explicitly configures otherwise
  categoryStyle:    "rounded",
  productCardStyle: "modern",
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convert a 6-digit hex color to an rgba() string */
export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "")
  if (clean.length !== 6) return `rgba(0,0,0,${alpha})`
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

/** Return the CSS background-color for the PWA app bar */
export function getPwaHeaderBg(theme: PwaHeaderTheme, brandColor: string): string {
  switch (theme) {
    case "white":      return "#FFFFFF"
    case "brandTint":  return hexToRgba(brandColor, 0.06)
    case "brandColor": return brandColor
    default:           return hexToRgba(brandColor, 0.06)
  }
}

/** Return the primary text/icon color for the PWA app bar */
export function getPwaHeaderFg(theme: PwaHeaderTheme): string {
  return theme === "brandColor" ? "#FFFFFF" : "#111827"
}

/** Return the muted/secondary color for the PWA app bar (store name, icons) */
export function getPwaHeaderMuted(theme: PwaHeaderTheme, brandColor: string): string {
  return theme === "brandColor" ? "rgba(255,255,255,0.85)" : brandColor
}

/** Return the icon color for the PWA app bar */
export function getPwaHeaderIcon(theme: PwaHeaderTheme): string {
  return theme === "brandColor" ? "#FFFFFF" : "#374151"
}
