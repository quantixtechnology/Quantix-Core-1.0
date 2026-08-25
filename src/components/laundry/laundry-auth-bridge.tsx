"use client"

import { useEffect } from "react"

// ─────────────────────────────────────────────────────────────────────────────
// Laundry OS auth bridge.
//
// Laundry OS tenant screens call the API with plain fetch() and carry no auth
// header — tenants authenticate with the access token issued by
// /api/core/auth/login and stored in localStorage (quantix_auth_token); there
// is NO NextAuth session cookie for tenant users. The server-side Laundry RBAC
// guard (requireLaundryPermission) needs to identify the caller, so this bridge
// transparently attaches that token as `Authorization: Bearer …` to the
// workspace's own API requests.
//
// It used to match only "/api/laundry", which left every /api/core call in the
// workspace — around forty of them, including notifications, customers and
// orders — going out with NO Authorization header. Those endpoints authenticate
// from that header alone (extractUserFromRequest in lib/middleware.ts reads no
// cookie), so they answered 401 and the screen said "Access Denied". It looked
// like a permission problem; nothing was ever being authenticated.
//
// Scope:
//   • SAME-ORIGIN /api/ requests only — never a third-party URL.
//   • Requests that already carry an Authorization header (e.g. the separate
//     Customer App, which uses its own token) are left untouched.
//   • Everything else passes straight through to the original fetch.
// The bridge is mounted only inside the Laundry OS shell, so a customer session
// can never pick up a staff token from it.
// Mounted once inside the Laundry OS shell; restores the original fetch on
// unmount. Idempotent (guards against double-patching under Fast Refresh).
// ─────────────────────────────────────────────────────────────────────────────
export function LaundryAuthBridge() {
  useEffect(() => {
    if (typeof window === "undefined") return
    const w = window as typeof window & { __laundryFetchPatched?: boolean }
    if (w.__laundryFetchPatched) return

    const original = window.fetch.bind(window)
    w.__laundryFetchPatched = true

    window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      try {
        const url =
          typeof input === "string" ? input : input instanceof URL ? input.toString() : ""
        // Only augment plain string/URL calls to THIS app's API. Request objects
        // and cross-origin URLs pass through unchanged.
        let path = ""
        if (url.startsWith("/")) path = url
        else if (url) {
          try {
            const u = new URL(url, window.location.origin)
            if (u.origin === window.location.origin) path = u.pathname
          } catch { /* not a URL we can reason about — leave it alone */ }
        }
        if (path.startsWith("/api/")) {
          const token = localStorage.getItem("quantix_auth_token")
          if (token) {
            const headers = new Headers(init?.headers)
            if (!headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`)
            const businessId = localStorage.getItem("quantix_business_id")
            if (businessId && !headers.has("x-business-id")) headers.set("x-business-id", businessId)
            init = { ...init, headers }
          }
        }
      } catch {
        // Any failure here must never block the request — fall through.
      }
      return original(input, init)
    }

    return () => {
      window.fetch = original
      w.__laundryFetchPatched = false
    }
  }, [])

  return null
}
