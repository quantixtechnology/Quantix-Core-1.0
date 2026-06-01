// ============================================================================
// Design System — barrel export
// import { TYPE, ANIM, BTN_MD, primaryBtnStyle } from "@/design-system"
// ============================================================================

export * from "./colors"
export * from "./spacing"
export * from "./typography"
export * from "./shadows"
export * from "./buttons"
export * from "./animations"

// ── Card style presets ────────────────────────────────────────────────────
// Driven by BusinessTheme.cardStyle; consumed by StorefrontProductCard.

export type CardStyle = "modern" | "minimal" | "bold"

export function getCardClasses(cardStyle: CardStyle = "modern"): string {
  switch (cardStyle) {
    case "minimal":
      return "bg-white rounded-lg border border-gray-200 overflow-hidden cursor-pointer group hover:border-gray-400 transition-all duration-200"
    case "bold":
      return "bg-white rounded-2xl border-2 border-gray-800 overflow-hidden cursor-pointer group hover:shadow-md transition-all duration-200"
    default: // modern
      return "bg-white rounded-xl border border-gray-100 overflow-hidden cursor-pointer group hover:shadow-md hover:border-gray-200 transition-all duration-200"
  }
}
