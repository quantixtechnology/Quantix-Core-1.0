// ============================================================================
// Design System — Animations
// ============================================================================

export const ANIM = {
  /** Pulse shimmer for all loading skeleton containers */
  SKELETON:     "animate-pulse",

  /** Fade-in on mount (Next.js animate-in plugin) */
  FADE_IN:      "animate-in fade-in duration-300",

  /** Hover scale on product images (inside a `group` container) */
  IMG_HOVER:    "group-hover:scale-105 transition-transform duration-300",

  /** Standard all-properties transition for interactive elements */
  TRANSITION:   "transition-all duration-200",

  /** Card hover: border lightens + shadow deepens */
  CARD_HOVER:   "hover:shadow-md hover:border-gray-200 transition-all duration-200",

  /** Opacity transition for fade-in images */
  FADE_OPACITY: "transition-opacity duration-300",
} as const
