"use client"

// ============================================================================
// QUANTIX CORE — InstallAppButton
//
// Compact, premium header CTA sitting between the search bar and cart.
//
// Mode:
//   'pwa'        — triggers the native PWA beforeinstallprompt flow.
//                  Auto-hides when already installed or unsupported.
//   'playstore'  — opens a Google Play Store URL in a new tab.
//   'appstore'   — opens an Apple App Store URL in a new tab.
//
// Switching modes later (pwa → playstore) is a single prop change —
// the visual design stays identical.
//
// Visibility rules:
//   pwa        — rendered only when canInstall is true
//   playstore  — rendered only when playstoreUrl is provided
//   appstore   — rendered only when appstoreUrl is provided
// ============================================================================

import { useState, useCallback } from "react"
import { ArrowDownToLine } from "lucide-react"
import { usePwaInstall } from "@/hooks/use-pwa-install"

// ─── Types ────────────────────────────────────────────────────────────────────

export type InstallMode = "pwa" | "playstore" | "appstore"

export interface InstallAppButtonProps {
  /** Controls which install flow is used. Default: 'pwa' */
  mode?: InstallMode
  /** Brand accent colour — used for icon tint and hover ring */
  brandColor?: string
  /** Required when mode='playstore' */
  playstoreUrl?: string
  /** Required when mode='appstore' */
  appstoreUrl?: string
  /** Extra className forwarded to the root element */
  className?: string
}

// ─── Platform store icons (monochrome SVGs) ───────────────────────────────────

function PlayStoreIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M3.18 23.76a2 2 0 0 1-1.18-1.8V2.04A2 2 0 0 1 3.18.28L14.8 12 3.18 23.72z" opacity=".55" />
      <path d="M19.07 16.2 5.64 23.46l9.04-9.04 4.39 1.78z" opacity=".8" />
      <path d="M22.46 10.56a2 2 0 0 1 0 2.88l-3.39 1.76-4.84-4.84 4.84-4.84 3.39 2.04z" />
      <path d="M5.64.54 19.07 7.8l-4.39 4.39-9.04-9.03z" opacity=".8" />
    </svg>
  )
}

function AppStoreIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  )
}

// ─── Shared inner content (identical across all modes) ───────────────────────

interface ContentProps {
  mode: InstallMode
  installing: boolean
  brandColor: string
  hovered: boolean
}

function Content({ mode, installing, brandColor, hovered }: ContentProps) {
  return (
    <>
      {/* Icon — tinted with brandColor, always visible including on mobile */}
      <span
        className="flex items-center justify-center flex-shrink-0 transition-transform duration-200"
        style={{
          color: brandColor,
          transform: hovered ? "scale(1.15)" : "scale(1)",
        }}
      >
        {mode === "pwa"       && <ArrowDownToLine className="w-[15px] h-[15px]" strokeWidth={2.2} />}
        {mode === "playstore" && <PlayStoreIcon />}
        {mode === "appstore"  && <AppStoreIcon />}
      </span>

      {/* Label — icon-only on mobile (<sm), icon+text on desktop */}
      <span className="hidden sm:block text-sm font-medium leading-none tracking-tight whitespace-nowrap transition-colors duration-200"
            style={{ color: hovered ? "#111827" : "#374151" }}>
        {installing ? "Installing…" : "Install App"}
      </span>

      {/* Animated bottom accent line — brand colour, grows on hover */}
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 h-[2px] rounded-full transition-all duration-300 ease-out"
        style={{
          backgroundColor: brandColor,
          width: hovered ? "60%" : "0%",
          opacity: hovered ? 1 : 0,
        }}
      />
    </>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function InstallAppButton({
  mode = "pwa",
  brandColor = "#10B981",
  playstoreUrl,
  appstoreUrl,
  className = "",
}: InstallAppButtonProps) {
  // All hooks must run unconditionally
  const pwa = usePwaInstall()
  const [installing, setInstalling] = useState(false)
  const [hovered, setHovered] = useState(false)

  const handlePwaClick = useCallback(async () => {
    if (installing) return
    setInstalling(true)
    try {
      await pwa.install()
    } finally {
      setInstalling(false)
    }
  }, [installing, pwa])

  // ── Visibility guards ─────────────────────────────────────────────────────
  if (mode === "pwa"       && !pwa.canInstall)  return null
  if (mode === "playstore" && !playstoreUrl)    return null
  if (mode === "appstore"  && !appstoreUrl)     return null

  // ── Shared styles ─────────────────────────────────────────────────────────
  const baseClass = [
    "group relative flex items-center gap-1.5 px-3 h-9 rounded-xl",
    "border transition-all duration-200 ease-out",
    "focus-visible:outline-none",
    "overflow-hidden select-none cursor-pointer",
    className,
  ].filter(Boolean).join(" ")

  const dynamicStyle: React.CSSProperties = {
    borderColor:     hovered ? `${brandColor}50` : "#e5e7eb",
    backgroundColor: hovered ? `${brandColor}08` : "#ffffff",
    boxShadow:       hovered ? `0 0 0 3px ${brandColor}18` : "none",
  }

  const hover = {
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
    onFocus:      () => setHovered(true),
    onBlur:       () => setHovered(false),
  }

  const contentProps: ContentProps = { mode, installing, brandColor, hovered }

  // ── PWA: <button> ─────────────────────────────────────────────────────────
  if (mode === "pwa") {
    return (
      <button
        type="button"
        disabled={installing}
        onClick={handlePwaClick}
        aria-label="Install app"
        className={baseClass}
        style={dynamicStyle}
        {...hover}
      >
        <Content {...contentProps} />
      </button>
    )
  }

  // ── Play Store / App Store: <a> ───────────────────────────────────────────
  const href = mode === "playstore" ? playstoreUrl! : appstoreUrl!

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Download app"
      className={baseClass}
      style={dynamicStyle}
      {...hover}
    >
      <Content {...contentProps} />
    </a>
  )
}
