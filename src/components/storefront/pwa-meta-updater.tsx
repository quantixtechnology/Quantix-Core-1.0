"use client"

// PwaMetaUpdater — runs inside every storefront page after business context loads.
//
// What it does:
//   1. Syncs <meta name="theme-color"> with the business's primary color so the
//      Android Chrome toolbar and iOS status bar match the brand.
//   2. Updates <link rel="apple-touch-icon"> with the business logo so the iOS
//      "Add to Home Screen" icon shows the correct brand image.
//   3. Updates <meta name="apple-mobile-web-app-title"> with the business name.
//
// Why not do this in layout.tsx?
//   The root layout is a shared Server Component — it can't read per-tenant data
//   at render time (tenant is detected client-side from window.location.hostname).
//   This component bridges that gap.

import { useEffect } from "react"
import { useAdminStore } from "@/stores/admin-store"

export function PwaMetaUpdater() {
  const { currentBusinessName, currentBusinessPrimaryColor, currentBusinessLogo } = useAdminStore()

  useEffect(() => {
    if (!currentBusinessPrimaryColor) return

    // ── theme-color ──────────────────────────────────────────────────────────
    // Update all theme-color meta tags (Next.js may emit multiple for media queries)
    document.querySelectorAll('meta[name="theme-color"]').forEach((el) => {
      el.setAttribute("content", currentBusinessPrimaryColor)
    })

    // ── apple-touch-icon ─────────────────────────────────────────────────────
    if (currentBusinessLogo) {
      const existing = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]')
      if (existing) {
        existing.href = currentBusinessLogo
      } else {
        const link = document.createElement("link")
        link.rel  = "apple-touch-icon"
        link.href = currentBusinessLogo
        document.head.appendChild(link)
      }
    }
  }, [currentBusinessPrimaryColor, currentBusinessLogo])

  useEffect(() => {
    if (!currentBusinessName) return

    // ── apple-mobile-web-app-title ───────────────────────────────────────────
    const existing = document.querySelector<HTMLMetaElement>(
      'meta[name="apple-mobile-web-app-title"]'
    )
    if (existing) {
      existing.content = currentBusinessName
    } else {
      const meta = document.createElement("meta")
      meta.name    = "apple-mobile-web-app-title"
      meta.content = currentBusinessName
      document.head.appendChild(meta)
    }

    // ── document.title ────────────────────────────────────────────────────────
    // Only update on storefront domains — don't clobber the admin app title
    if (typeof window !== "undefined" && window.location.hostname !== "localhost") {
      document.title = currentBusinessName
    }
  }, [currentBusinessName])

  return null
}
