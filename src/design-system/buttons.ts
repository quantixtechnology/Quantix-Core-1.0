// ============================================================================
// Design System — Buttons
//
// Base Tailwind class strings + inline-style helpers for brand-colored buttons.
// Components combine a base class string with style={{ ...primaryBtnStyle(color) }}.
// ============================================================================

import type { CSSProperties } from "react"

// ── Base class strings ────────────────────────────────────────────────────

export const BTN_BASE =
  "inline-flex items-center justify-center font-semibold transition-all duration-200 rounded-xl"

export const BTN_SM   = `${BTN_BASE} text-xs px-3 py-1.5`
export const BTN_MD   = `${BTN_BASE} text-sm px-5 py-2.5`
export const BTN_LG   = `${BTN_BASE} text-sm px-6 py-3`
export const BTN_ICON = "w-7 h-7 rounded-lg flex items-center justify-center transition-opacity hover:opacity-90"

/** Ghost / outline button — no background */
export const BTN_GHOST =
  "inline-flex items-center justify-center font-semibold text-sm px-5 py-2.5 " +
  "rounded-xl border border-white/30 text-white hover:bg-white/20 transition-colors"

// ── Inline-style helpers ──────────────────────────────────────────────────

export function primaryBtnStyle(brandColor: string): CSSProperties {
  return { backgroundColor: brandColor, color: "#fff" }
}

export function outlineBtnStyle(brandColor: string): CSSProperties {
  return { borderColor: brandColor, color: brandColor }
}

export function iconBtnStyle(brandColor: string): CSSProperties {
  return { backgroundColor: brandColor, color: "#fff" }
}
