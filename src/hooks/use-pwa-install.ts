"use client"

// usePwaInstall — cross-platform PWA install prompt hook.
//
// Android / Chrome / Edge / Samsung Internet:
//   - Captures the browser's `beforeinstallprompt` event.
//   - Also recovers events captured by the early-capture script in layout.tsx
//     (window.__bip) which fires before React hydration.
//   - `install()` triggers the native Add-to-Home-Screen dialog.
//
// iOS / Safari:
//   - `beforeinstallprompt` is never fired on iOS.
//   - `isIos` + `!isInstalled` signals that manual Safari instructions
//     should be shown instead.
//
// Options:
//   ignoreDismiss — when true, the button appears even if the home-page
//                   banner was dismissed. The header Install App button uses
//                   this so a dismissed banner doesn't suppress the header CTA.

import { useState, useEffect, useCallback } from "react"

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

// Typed window extension for the early-capture script in layout.tsx
declare global {
  interface Window {
    __bip:            BeforeInstallPromptEvent | null
    __bipCapturedAt:  number | null
  }
}

const DISMISS_KEY    = "quantix_pwa_dismissed_at"
const DISMISS_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

function isDismissed(): boolean {
  try {
    const ts = localStorage.getItem(DISMISS_KEY)
    if (!ts) return false
    return Date.now() - parseInt(ts, 10) < DISMISS_TTL_MS
  } catch {
    return false
  }
}

function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent) &&
    !("MSStream" in window)
}

function isInStandaloneMode(): boolean {
  if (typeof window === "undefined") return false
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && (navigator as { standalone?: boolean }).standalone === true)
  )
}

// Best-effort: returns true for Chromium browsers that can fire beforeinstallprompt.
// Not a hard gate — the event is the only reliable signal, but this helps debug output.
function canBrowserFireBip(): boolean {
  if (typeof window === "undefined") return false
  const ua = navigator.userAgent
  // Chromium family (Chrome, Edge, Opera, Samsung Internet, Brave, Arc…)
  // but NOT Firefox, Safari, or Firefox-on-Android
  const isChromium = /Chrome\/|Chromium\/|EdgA?\/|OPR\/|SamsungBrowser\//i.test(ua)
  const isSafari   = /Safari\//i.test(ua) && !/Chrome\//i.test(ua)
  return isChromium && !isSafari
}

export interface PwaInstallOptions {
  /** When true, ignores the 30-day banner-dismiss flag. Default: false. */
  ignoreDismiss?: boolean
}

export interface PwaInstallState {
  /** True when an install prompt can be shown */
  canInstall:   boolean
  /** True when running in standalone / installed mode */
  isInstalled:  boolean
  /** True when on iOS Safari (show manual "Add to Home Screen" instructions) */
  isIos:        boolean
  /** True if the browser is theoretically capable of firing beforeinstallprompt */
  browserSupported: boolean
  /** True if the prompt was captured early (before React hydration) */
  capturedEarly: boolean
  /** Raw reason string — populated when canInstall is false */
  hiddenReason: string
  /** Trigger the native install dialog. Returns true if accepted. */
  install:      () => Promise<boolean>
  /** Dismiss the banner for 30 days */
  dismiss:      () => void
}

export function usePwaInstall(options: PwaInstallOptions = {}): PwaInstallState {
  const { ignoreDismiss = false } = options

  const [prompt, setPrompt]           = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [dismissed, setDismissed]     = useState(false)
  const [capturedEarly, setCapturedEarly] = useState(false)

  useEffect(() => {
    // ── Already installed ────────────────────────────────────────────────────
    if (isInStandaloneMode()) {
      setIsInstalled(true)
      return
    }

    // ── Dismiss state ────────────────────────────────────────────────────────
    setDismissed(isDismissed())

    // ── Recover event captured before React hydrated ─────────────────────────
    // layout.tsx installs a synchronous listener that stores the event on
    // window.__bip before any useEffect can run. Claim it here if available.
    if (typeof window !== "undefined" && window.__bip) {
      setPrompt(window.__bip)
      setCapturedEarly(true)
      window.__bip = null // claim it — prevent double-use
    }

    // ── Live listener for events that fire after hydration ───────────────────
    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setPrompt(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setIsInstalled(true)
      setPrompt(null)
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstall)
    window.addEventListener("appinstalled",        onInstalled)

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall)
      window.removeEventListener("appinstalled",        onInstalled)
    }
  }, [])

  const install = useCallback(async (): Promise<boolean> => {
    if (!prompt) return false
    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    setPrompt(null)
    return outcome === "accepted"
  }, [prompt])

  const dismiss = useCallback(() => {
    try { localStorage.setItem(DISMISS_KEY, Date.now().toString()) } catch { /* ignore */ }
    setDismissed(true)
  }, [])

  const ios              = isIosDevice()
  const browserSupported = canBrowserFireBip() || ios
  const dismissBlocking  = !ignoreDismiss && dismissed

  const canInstall = !isInstalled && !dismissBlocking && (!!prompt || ios)

  // ── Hidden reason (for debug + console logging) ──────────────────────────
  let hiddenReason = ""
  if (canInstall) {
    hiddenReason = ""
  } else if (isInstalled) {
    hiddenReason = "App is already installed (running in standalone mode)"
  } else if (dismissBlocking) {
    hiddenReason = "Install banner was dismissed — hidden for 30 days (ignoreDismiss=false)"
  } else if (!ios && !prompt) {
    if (!browserSupported) {
      hiddenReason = "Browser does not support beforeinstallprompt (Firefox / Safari desktop)"
    } else {
      hiddenReason = "beforeinstallprompt has not fired yet — PWA criteria may not be fully met (check: manifest icons ≥192px, service worker active, HTTPS)"
    }
  }

  return {
    canInstall,
    isInstalled,
    isIos: ios,
    browserSupported,
    capturedEarly,
    hiddenReason,
    install,
    dismiss,
  }
}
