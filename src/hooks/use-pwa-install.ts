"use client"

// usePwaInstall — cross-platform PWA install prompt hook.
//
// Android / Chrome:
//   - Captures the browser's `beforeinstallprompt` event.
//   - `install()` triggers the native Add-to-Home-Screen dialog.
//
// iOS / Safari:
//   - `beforeinstallprompt` is never fired on iOS.
//   - `isIos` + `!isStandalone` signals that manual Safari instructions
//     should be shown instead.
//
// State is persisted: dismissed banners stay dismissed for 30 days.

import { useState, useEffect, useCallback } from "react"

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
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

export interface PwaInstallState {
  /** True when an install prompt can be shown (Android native or iOS manual) */
  canInstall:     boolean
  /** True when the app is already running in standalone / installed mode */
  isInstalled:    boolean
  /** True when the device is iOS (use manual Safari instructions instead) */
  isIos:          boolean
  /** Trigger the native Android install dialog. Returns true if accepted. */
  install:        () => Promise<boolean>
  /** Permanently dismiss the banner for 30 days */
  dismiss:        () => void
}

export function usePwaInstall(): PwaInstallState {
  const [prompt, setPrompt]           = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [dismissed, setDismissed]     = useState(false)

  useEffect(() => {
    // Already running as an installed PWA
    if (isInStandaloneMode()) {
      setIsInstalled(true)
      return
    }

    setDismissed(isDismissed())

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

  const ios = isIosDevice()

  // canInstall: Android has a live prompt ready, or iOS is in Safari (not yet installed)
  const canInstall = !isInstalled && !dismissed && (!!prompt || ios)

  return { canInstall, isInstalled, isIos: ios, install, dismiss }
}
