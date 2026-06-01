// ============================================================================
// Design System — Colors
//
// Neutral and semantic colors used across all storefront surfaces.
// Brand colors (primaryColor, secondaryColor, accentColor) come from
// useAdminStore().currentBusinessPrimaryColor / currentBusinessTheme.
//
// Use withAlpha(brandColor, 0.15) to create tinted backgrounds.
// Use brandOverlay(brandColor) for badge/button overlays.
// ============================================================================

// ── Neutral palette ───────────────────────────────────────────────────────
export const NEUTRAL = {
  50:  "#f9fafb",
  100: "#f3f4f6",
  200: "#e5e7eb",
  300: "#d1d5db",
  400: "#9ca3af",
  500: "#6b7280",
  600: "#4b5563",
  700: "#374151",
  800: "#1f2937",
  900: "#111827",
} as const

// ── Semantic colors ───────────────────────────────────────────────────────
export const SEMANTIC = {
  success: "#10b981",
  warning: "#f59e0b",
  error:   "#ef4444",
  info:    "#3b82f6",
} as const

// ── Badge colors ──────────────────────────────────────────────────────────
export const BADGE_COLORS = {
  veg:       { bg: "#22c55e", text: "#fff" },
  nonVeg:    { bg: "#ef4444", text: "#fff" },
  halal:     { bg: "#059669", text: "#fff" },
  outOfStock:{ bg: "#4b5563", text: "#fff" },
} as const

// ── Helpers ───────────────────────────────────────────────────────────────

/** Return a hex color with an appended 2-digit alpha suffix (00-ff).
 *  e.g. withAlpha("#10B981", 0.15) → "#10B981" + "26" */
export function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, "0")
  return `${hex}${a}`
}

/** Pre-defined alpha strengths for quick use */
export const ALPHA = {
  tint:    (h: string) => withAlpha(h, 0.10),  // very light bg
  surface: (h: string) => withAlpha(h, 0.15),  // category/card bg
  mid:     (h: string) => withAlpha(h, 0.30),  // icon bg
  badge:   (h: string) => withAlpha(h, 0.80),  // badge bg
} as const
