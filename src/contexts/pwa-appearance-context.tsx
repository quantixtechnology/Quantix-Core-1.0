"use client"

// PWA Appearance context — provides per-business appearance settings to all
// storefront components in installed PWA mode.
// Provider lives in StorefrontLayout (inside the isPwa branch).
// Components read via usePwaAppearance() — zero side-effects.

import { createContext, useContext } from "react"
import { type PwaAppearance, PWA_APPEARANCE_DEFAULTS } from "@/lib/pwa-appearance"

export const PwaAppearanceContext = createContext<PwaAppearance>(PWA_APPEARANCE_DEFAULTS)

export function usePwaAppearance(): PwaAppearance {
  return useContext(PwaAppearanceContext)
}
