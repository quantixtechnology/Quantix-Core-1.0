"use client"

// ============================================================================
// QUANTIX CORE — InstallAppButton
//
// Always visible in the storefront header between Search and Cart.
// The button never returns null — every browser and device sees it.
//
// Click behaviour by case:
//   CASE 1 · PWA prompt available (Chrome/Edge/Samsung Internet):
//             → triggers native beforeinstallprompt dialog immediately
//   CASE 2 · Android / generic — prompt not available:
//             → opens instruction modal: "Open menu → Add to Home Screen"
//   CASE 3 · iOS / iPadOS:
//             → opens instruction modal: "Tap Share → Add to Home Screen"
//   CASE 4 · Already installed (standalone mode):
//             → button hidden (app is already open as an installed PWA)
//
// InstallMode architecture (future-proof):
//   mode='pwa'       — current default, uses cases 1-3 above
//   mode='playstore' — opens playstoreUrl in new tab (always visible)
//   mode='appstore'  — opens appstoreUrl in new tab (always visible)
//   Switching modes requires only a prop change — UI is identical.
//
// DEBUG:  Set NEXT_PUBLIC_DEBUG_INSTALL_BUTTON=true to log diagnostics.
// ============================================================================

import { useState, useEffect, useCallback } from "react"
import {
  ArrowDownToLine, Smartphone, Share2, MoreVertical,
  ChevronRight, Check
} from "lucide-react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { usePwaInstall } from "@/hooks/use-pwa-install"

// ─── Debug flag (tree-shaken in production) ────────────────────────────────
const DEBUG = process.env.NEXT_PUBLIC_DEBUG_INSTALL_BUTTON === "true"

// ─── Types ─────────────────────────────────────────────────────────────────

export type InstallMode = "pwa" | "playstore" | "appstore"

export interface InstallAppButtonProps {
  mode?:          InstallMode
  brandColor?:    string
  playstoreUrl?:  string
  appstoreUrl?:   string
  className?:     string
}

type ModalVariant = "ios" | "android" | null

// ─── Platform store icons ───────────────────────────────────────────────────

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

// ─── Install instruction modal ──────────────────────────────────────────────

interface InstallModalProps {
  variant:    ModalVariant
  onClose:    () => void
  brandColor: string
}

function InstallModal({ variant, onClose, brandColor }: InstallModalProps) {
  const isIos = variant === "ios"

  const steps = isIos
    ? [
        { icon: <Share2 className="w-4 h-4" />, text: "Tap the Share button at the bottom of Safari" },
        { icon: <Smartphone className="w-4 h-4" />, text: 'Scroll down and tap "Add to Home Screen"' },
        { icon: <Check className="w-4 h-4" />, text: 'Tap "Add" to confirm' },
      ]
    : [
        { icon: <MoreVertical className="w-4 h-4" />, text: "Tap the browser menu ( ⋮ ) at the top right" },
        { icon: <Smartphone className="w-4 h-4" />, text: 'Select "Add to Home Screen"' },
        { icon: <Check className="w-4 h-4" />, text: 'Tap "Add" to confirm' },
      ]

  return (
    <Dialog open={!!variant} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-sm mx-4 rounded-2xl p-0 overflow-hidden">
        {/* Colored header */}
        <div
          className="px-6 pt-6 pb-5 text-white"
          style={{ background: `linear-gradient(135deg, ${brandColor} 0%, ${brandColor}cc 100%)` }}
        >
          <div className="flex items-center gap-3 mb-1">
            <div className="bg-white/20 rounded-full p-2">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <DialogHeader className="text-left">
              <DialogTitle className="text-white text-lg font-bold leading-tight">
                Install App
              </DialogTitle>
              <DialogDescription className="text-white/80 text-sm leading-tight">
                {isIos ? "Add to your iPhone Home Screen" : "Add to your Android Home Screen"}
              </DialogDescription>
            </DialogHeader>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Step-by-step instructions */}
          <ol className="space-y-3">
            {steps.map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                {/* Step number */}
                <span
                  className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white mt-0.5"
                  style={{ backgroundColor: brandColor }}
                >
                  {i + 1}
                </span>
                {/* Icon + text */}
                <div className="flex items-center gap-2 flex-1">
                  <span className="flex-shrink-0 text-gray-400">{step.icon}</span>
                  <span className="text-sm text-gray-700 leading-snug">{step.text}</span>
                </div>
              </li>
            ))}
          </ol>

          {/* Visual hint */}
          <div className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 flex items-center gap-3">
            {isIos ? (
              <>
                <div className="bg-blue-500 rounded-lg p-1.5 flex-shrink-0">
                  <Share2 className="w-3.5 h-3.5 text-white" />
                </div>
                <p className="text-xs text-gray-500 leading-snug">
                  The Share button looks like a box with an arrow pointing up <strong>⬆</strong>.
                  It's in the Safari toolbar at the bottom of the screen.
                </p>
              </>
            ) : (
              <>
                <div className="bg-gray-700 rounded-lg p-1.5 flex-shrink-0">
                  <MoreVertical className="w-3.5 h-3.5 text-white" />
                </div>
                <p className="text-xs text-gray-500 leading-snug">
                  The browser menu is three dots <strong>⋮</strong> in the top-right corner
                  of Chrome or Samsung Internet.
                </p>
              </>
            )}
          </div>

          {/* Close button */}
          <Button
            className="w-full h-11 font-semibold text-white rounded-xl"
            style={{ backgroundColor: brandColor }}
            onClick={onClose}
          >
            Got it
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Button content (shared across modes) ──────────────────────────────────

interface ContentProps {
  mode:       InstallMode
  installing: boolean
  brandColor: string
  hovered:    boolean
}

function Content({ mode, installing, brandColor, hovered }: ContentProps) {
  return (
    <>
      {/* Icon — always visible, tinted with brandColor */}
      <span
        className="flex items-center justify-center flex-shrink-0 transition-transform duration-200"
        style={{ color: brandColor, transform: hovered ? "scale(1.15)" : "scale(1)" }}
      >
        {mode === "pwa"       && <ArrowDownToLine className="w-[15px] h-[15px]" strokeWidth={2.2} />}
        {mode === "playstore" && <PlayStoreIcon />}
        {mode === "appstore"  && <AppStoreIcon />}
      </span>

      {/* Label — hidden on xs screens to save header space */}
      <span
        className="hidden sm:block text-sm font-medium leading-none tracking-tight whitespace-nowrap transition-colors duration-200"
        style={{ color: hovered ? "#111827" : "#374151" }}
      >
        {installing ? "Installing…" : "Install App"}
      </span>

      {/* Animated bottom accent line */}
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 h-[2px] rounded-full transition-all duration-300 ease-out"
        style={{ backgroundColor: brandColor, width: hovered ? "60%" : "0%", opacity: hovered ? 1 : 0 }}
      />
    </>
  )
}

// ─── Main component ─────────────────────────────────────────────────────────

export function InstallAppButton({
  mode = "pwa",
  brandColor = "#10B981",
  playstoreUrl,
  appstoreUrl,
  className = "",
}: InstallAppButtonProps) {
  // ignoreDismiss=true: the header button is independent of the home-page banner.
  const pwa = usePwaInstall({ ignoreDismiss: true })
  const [installing, setInstalling] = useState(false)
  const [hovered,    setHovered]    = useState(false)
  const [modal,      setModal]      = useState<ModalVariant>(null)

  // ── Debug diagnostics ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!DEBUG) return
    const bipEarly = typeof window !== "undefined" && window.__bipCapturedAt !== null
    console.groupCollapsed(
      `%c[InstallAppButton] diagnostics`,
      "background:#f59e0b;color:#000;padding:2px 6px;border-radius:3px;font-weight:bold"
    )
    console.table({
      mode,
      canInstall:          pwa.canInstall,
      isInstalled:         pwa.isInstalled,
      isIos:               pwa.isIos,
      browserSupported:    pwa.browserSupported,
      capturedEarly:       bipEarly,
      hiddenReason:        pwa.hiddenReason || "(button always visible)",
    })
    console.groupEnd()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pwa.canInstall, pwa.isInstalled])

  const handlePwaClick = useCallback(async () => {
    if (installing) return

    if (pwa.canInstall) {
      // CASE 1 — native prompt available
      setInstalling(true)
      try { await pwa.install() }
      finally { setInstalling(false) }
      return
    }

    if (pwa.isIos) {
      // CASE 3 — iOS Safari manual instructions
      setModal("ios")
      return
    }

    // CASE 2 — Android / generic fallback instructions
    setModal("android")
  }, [installing, pwa])

  // ── Hide only when running as standalone (already installed) ───────────────
  // This is the single remaining visibility guard: showing "Install App" inside
  // an already-installed PWA is confusing. All other cases always render.
  // Play Store / App Store modes are never hidden.
  if (mode === "pwa" && pwa.isInstalled) return null

  // ── Shared styles ─────────────────────────────────────────────────────────
  const baseClass = [
    "group relative flex items-center gap-1.5 px-3 h-9 rounded-xl",
    "border transition-all duration-200 ease-out",
    "focus-visible:outline-none overflow-hidden select-none cursor-pointer",
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

  // ── PWA mode ───────────────────────────────────────────────────────────────
  if (mode === "pwa") {
    return (
      <>
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

        <InstallModal
          variant={modal}
          onClose={() => setModal(null)}
          brandColor={brandColor}
        />
      </>
    )
  }

  // ── Play Store mode ────────────────────────────────────────────────────────
  if (mode === "playstore" && playstoreUrl) {
    return (
      <a
        href={playstoreUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Download on Google Play"
        className={baseClass}
        style={dynamicStyle}
        {...hover}
      >
        <Content {...contentProps} />
      </a>
    )
  }

  // ── App Store mode ─────────────────────────────────────────────────────────
  if (mode === "appstore" && appstoreUrl) {
    return (
      <a
        href={appstoreUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Download on the App Store"
        className={baseClass}
        style={dynamicStyle}
        {...hover}
      >
        <Content {...contentProps} />
      </a>
    )
  }

  // playstore/appstore without a URL — still show button (navigates nowhere)
  // This preserves layout space and allows the URL to be wired up later.
  return (
    <button
      type="button"
      aria-label="Install app"
      className={baseClass}
      style={dynamicStyle}
      {...hover}
    >
      <Content {...contentProps} />
    </button>
  )
}
