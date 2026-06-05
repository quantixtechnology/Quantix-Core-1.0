"use client"

// Single source of truth for PWA detection.
// The provider lives in StorefrontLayout — one useState + one matchMedia listener total.
// All descendant components read via usePwaModeCtx() (useContext, zero side-effects).

import { createContext, useContext } from "react"

export const PwaModeContext = createContext<boolean>(false)

export function usePwaModeCtx(): boolean {
  return useContext(PwaModeContext)
}
