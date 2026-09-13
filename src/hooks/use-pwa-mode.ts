"use client"
import { useState, useEffect } from "react"

/**
 * The user-agent token appended by the Quantix Android shell
 * (android-wrapper MainActivity). It exists so a WebView can be told apart
 * from a browser tab — and ONLY for that: it selects the installed-app shell.
 * Nothing authoritative may ever read it.
 */
const QUANTIX_SHELL_UA = /QuantixApp\/\d+/i

/**
 * Pure shell detection: true when the page should wear the installed-app
 * shell. Kept out of the hook so the single rule is unit-testable.
 * Presentation only — never used by auth, pricing, orders or any API.
 */
export function isPwaShell(
  standaloneMediaMatches: boolean,
  iosStandalone: boolean,
  userAgent: string,
): boolean {
  return standaloneMediaMatches || iosStandalone || QUANTIX_SHELL_UA.test(userAgent)
}

/**
 * Returns true only when the app is running in an installed-app shell:
 *  - a genuinely installed PWA (Android display-mode: standalone, or iOS
 *    navigator.standalone), or
 *  - the Quantix Android WebView shell (marked in its user agent), so the
 *    customer APK renders the same app shell an installed PWA uses.
 * Returns false for regular browser tabs on any device/screen size.
 *
 * SSR-safe: always false on the server; updates after hydration.
 */
export function usePwaMode(): boolean {
  const [isPwa, setIsPwa] = useState(false)

  useEffect(() => {
    const check = () => {
      const standaloneMedia = window.matchMedia("(display-mode: standalone)").matches
      const iosStandalone   = (window.navigator as { standalone?: boolean }).standalone === true
      setIsPwa(isPwaShell(standaloneMedia, iosStandalone, window.navigator.userAgent))
    }

    check()

    const mq = window.matchMedia("(display-mode: standalone)")
    mq.addEventListener("change", check)
    return () => mq.removeEventListener("change", check)
  }, [])

  return isPwa
}