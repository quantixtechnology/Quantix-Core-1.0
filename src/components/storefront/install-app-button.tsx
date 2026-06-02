"use client"

// ============================================================================
// QUANTIX CORE — InstallAppButton
//
// Compact, premium header CTA between the search bar and cart.
//
// InstallMode:
//   'pwa'        — triggers the native beforeinstallprompt flow.
//                  Auto-hides when already installed or unsupported.
//                  Uses ignoreDismiss=true so the home-page banner's
//                  dismiss state does NOT suppress the header button.
//   'playstore'  — opens a Google Play Store URL in a new tab.
//   'appstore'   — opens an Apple App Store URL in a new tab.
//
// DEBUG MODE — set NEXT_PUBLIC_DEBUG_INSTALL_BUTTON=true in .env:
//   • Button always renders regardless of canInstall state.
//   • A "DBG" badge appears on the button.
//   • On mount, console.table() logs every diagnostic signal.
//   • Reason the button would normally be hidden is logged at warn level.
// ============================================================================

import { useState, useEffect, useCallback } from "react"
import { ArrowDownToLine } from "lucide-react"
import { usePwaInstall } from "@/hooks/use-pwa-install"

// ─── Feature flag ─────────────────────────────────────────────────────────────
// Set NEXT_PUBLIC_DEBUG_INSTALL_BUTTON=true in .env to enable debug mode.
// Never commit true to production — the flag is intentionally a build-time
// env var so it tree-shakes in production builds.
const DEBUG = process.env.NEXT_PUBLIC_DEBUG_INSTALL_BUTTON === "true"

// ─── Types ────────────────────────────────────────────────────────────────────

export type InstallMode = "pwa" | "playstore" | "appstore"

export interface InstallAppButtonProps {
  mode?:          InstallMode
  brandColor?:    string
  playstoreUrl?:  string
  appstoreUrl?:   string
  className?:     string
}

// ─── Platform store SVG icons ─────────────────────────────────────────────────

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

// ─── Shared inner content ─────────────────────────────────────────────────────

interface ContentProps {
  mode:       InstallMode
  installing: boolean
  brandColor: string
  hovered:    boolean
  debug:      boolean
}

function Content({ mode, installing, brandColor, hovered, debug }: ContentProps) {
  return (
    <>
      {/* Icon */}
      <span
        className="flex items-center justify-center flex-shrink-0 transition-transform duration-200"
        style={{ color: brandColor, transform: hovered ? "scale(1.15)" : "scale(1)" }}
      >
        {mode === "pwa"       && <ArrowDownToLine className="w-[15px] h-[15px]" strokeWidth={2.2} />}
        {mode === "playstore" && <PlayStoreIcon />}
        {mode === "appstore"  && <AppStoreIcon />}
      </span>

      {/* Label — hidden below sm breakpoint */}
      <span
        className="hidden sm:block text-sm font-medium leading-none tracking-tight whitespace-nowrap transition-colors duration-200"
        style={{ color: hovered ? "#111827" : "#374151" }}
      >
        {installing ? "Installing…" : "Install App"}
      </span>

      {/* Debug badge */}
      {debug && (
        <span className="hidden sm:flex items-center text-[9px] font-bold px-1 py-0.5 rounded bg-amber-400 text-amber-900 leading-none ml-0.5">
          DBG
        </span>
      )}

      {/* Animated bottom accent line */}
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 h-[2px] rounded-full transition-all duration-300 ease-out"
        style={{ backgroundColor: brandColor, width: hovered ? "60%" : "0%", opacity: hovered ? 1 : 0 }}
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

  // ignoreDismiss=true: the header Install App button must NOT be hidden just
  // because the user dismissed the home-page bottom banner. They are separate
  // UI surfaces with separate dismiss intentions.
  const pwa = usePwaInstall({ ignoreDismiss: true })
  const [installing, setInstalling] = useState(false)
  const [hovered,    setHovered]    = useState(false)

  // ── Debug diagnostics ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!DEBUG) return

    const bipEarly = typeof window !== "undefined" && window.__bipCapturedAt !== null
    const isStandalone = typeof window !== "undefined" &&
      (window.matchMedia("(display-mode: standalone)").matches ||
       ("standalone" in navigator && (navigator as { standalone?: boolean }).standalone === true))
    const dismissTs = (() => {
      try { return localStorage.getItem("quantix_pwa_dismissed_at") } catch { return null }
    })()
    const dismissedAt = dismissTs ? new Date(parseInt(dismissTs, 10)).toISOString() : "never"

    const diagnostics = {
      "mode":                               mode,
      "canInstall":                         pwa.canInstall,
      "isInstalled (standalone)":           pwa.isInstalled,
      "isIos":                              pwa.isIos,
      "browserSupported":                   pwa.browserSupported,
      "beforeinstallprompt — early capture (window.__bip)": bipEarly,
      "beforeinstallprompt — live listener": !bipEarly && pwa.canInstall,
      "standalone mode":                    isStandalone,
      "dismiss key present":                !!dismissTs,
      "dismissed at":                       dismissedAt,
      "ignoreDismiss":                      true,
      "hiddenReason":                       pwa.hiddenReason || "(button is visible)",
    }

    console.groupCollapsed(
      `%c[InstallAppButton] DEBUG diagnostics — canInstall=${pwa.canInstall}`,
      "background:#f59e0b;color:#000;padding:2px 6px;border-radius:3px;font-weight:bold"
    )
    console.table(diagnostics)
    if (!pwa.canInstall && pwa.hiddenReason) {
      console.warn(
        `%c[InstallAppButton] Button would be HIDDEN in production.\n  Reason: ${pwa.hiddenReason}`,
        "color:#ef4444;font-weight:bold"
      )
    } else {
      console.info(
        "%c[InstallAppButton] Button is VISIBLE ✅",
        "color:#10b981;font-weight:bold"
      )
    }
    console.groupEnd()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pwa.canInstall, pwa.isInstalled])

  const handlePwaClick = useCallback(async () => {
    if (installing) return
    setInstalling(true)
    try { await pwa.install() }
    finally { setInstalling(false) }
  }, [installing, pwa])

  // ── Visibility guards ────────────────────────────────────────────────────────
  // In DEBUG mode the guards are bypassed so the button always renders.
  // In production mode the button renders only when canInstall is true.
  if (!DEBUG) {
    if (mode === "pwa"       && !pwa.canInstall)  return null
    if (mode === "playstore" && !playstoreUrl)    return null
    if (mode === "appstore"  && !appstoreUrl)     return null
  }

  // ── Shared styles ─────────────────────────────────────────────────────────
  const baseClass = [
    "group relative flex items-center gap-1.5 px-3 h-9 rounded-xl",
    "border transition-all duration-200 ease-out",
    "focus-visible:outline-none overflow-hidden select-none cursor-pointer",
    // Debug: amber border to make it visible even when canInstall=false
    DEBUG && !pwa.canInstall ? "border-amber-400 bg-amber-50" : "",
    className,
  ].filter(Boolean).join(" ")

  const dynamicStyle: React.CSSProperties = DEBUG && !pwa.canInstall
    ? { borderColor: "#f59e0b", backgroundColor: "#fffbeb" }
    : {
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

  const contentProps: ContentProps = { mode, installing, brandColor, hovered, debug: DEBUG }

  // ── PWA: <button> ─────────────────────────────────────────────────────────
  if (mode === "pwa") {
    return (
      <button
        type="button"
        disabled={installing || (DEBUG && !pwa.canInstall)}
        onClick={DEBUG && !pwa.canInstall ? undefined : handlePwaClick}
        aria-label="Install app"
        className={baseClass}
        style={dynamicStyle}
        title={DEBUG && !pwa.canInstall ? `DEBUG: ${pwa.hiddenReason}` : undefined}
        {...hover}
      >
        <Content {...contentProps} />
      </button>
    )
  }

  // ── Play Store / App Store: <a> ───────────────────────────────────────────
  const href = mode === "playstore" ? (playstoreUrl ?? "#") : (appstoreUrl ?? "#")

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
