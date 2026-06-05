"use client"
import { useState, useEffect } from "react"

/**
 * Returns true only when the app is running as an installed PWA
 * (Android display-mode: standalone OR iOS navigator.standalone).
 * Returns false for regular browser tabs on any device/screen size.
 *
 * SSR-safe: always false on the server; updates after hydration.
 */
export function usePwaMode(): boolean {
  const [isPwa, setIsPwa] = useState(false)

  useEffect(() => {
    const check = () => {
      const standaloneMedia = window.matchMedia("(display-mode: standalone)").matches
      // iOS Safari sets navigator.standalone
      const iosStandalone   = (window.navigator as { standalone?: boolean }).standalone === true
      setIsPwa(standaloneMedia || iosStandalone)
    }

    check()

    const mq = window.matchMedia("(display-mode: standalone)")
    mq.addEventListener("change", check)
    return () => mq.removeEventListener("change", check)
  }, [])

  return isPwa
}
