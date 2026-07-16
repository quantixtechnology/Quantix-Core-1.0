// ============================================================================
// Cross-subdomain session handoff
//
// Auth is stored in localStorage (the `quantix_auth_*` keys) and sent via the
// Authorization: Bearer header. localStorage is PER-ORIGIN, so a session on
// app.<base> is NOT visible on commerce.<base> / laundry.<base>. When a platform
// admin launches "Open Workspace", the new product-subdomain tab therefore has
// no session → /refresh/auth fail ("Session not found") → Access Denied.
//
// This module hands the existing session to the product origin via the URL
// fragment (which is never sent to the server or in the Referer header). The
// launcher attaches it; the product SPA imports it into its own localStorage on
// initialization, then strips the fragment immediately. No cookie, middleware,
// routing, or auth-flow changes — the existing localStorage hydration is reused.
// ============================================================================

// The exact localStorage keys that make up a session (mirror auth-store STORAGE_KEYS).
const SESSION_KEYS = [
  "quantix_auth_user",
  "quantix_auth_token",
  "quantix_auth_refresh_token",
  "quantix_auth_business_id",
  "quantix_auth_business_name",
  "quantix_auth_business_type",
  "quantix_auth_role",
  "quantix_auth_permissions",
  "quantix_auth_businesses",
] as const

const TOKEN_KEY = "quantix_auth_token"
const REFRESH_KEY = "quantix_auth_refresh_token"
const HANDOFF_PARAM = "__qxsession"

function b64encode(s: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(s)))
}
function b64decode(s: string): string {
  return new TextDecoder().decode(Uint8Array.from(atob(s), (c) => c.charCodeAt(0)))
}

/**
 * Build a URL fragment carrying the current origin's session, e.g.
 * "__qxsession=<base64>". Returns "" if there is no session to hand off.
 */
export function buildSessionHandoffHash(): string {
  if (typeof window === "undefined") return ""
  try {
    const bag: Record<string, string> = {}
    for (const k of SESSION_KEYS) {
      const v = window.localStorage.getItem(k)
      if (v != null) bag[k] = v
    }
    if (!bag[TOKEN_KEY]) return ""
    return `${HANDOFF_PARAM}=${encodeURIComponent(b64encode(JSON.stringify(bag)))}`
  } catch {
    return ""
  }
}

/**
 * If the URL fragment contains a handed-off session, import it into this
 * origin's localStorage (only when this origin has no session yet — never
 * clobber a real local login), then strip the fragment. Safe to call once on
 * app initialization, before reading localStorage.
 *
 * Returns true when a handoff was actually imported — the caller then swaps the
 * (shared) handoff refresh token for an origin-specific one via
 * exchangeHandoffSession(), so this origin rotates independently.
 */
export function importSessionFromHash(): boolean {
  if (typeof window === "undefined") return false
  const hash = window.location.hash.replace(/^#/, "")
  if (!hash.includes(HANDOFF_PARAM)) return false
  let imported = false
  try {
    const raw = new URLSearchParams(hash).get(HANDOFF_PARAM)
    if (raw && !window.localStorage.getItem(TOKEN_KEY)) {
      const bag = JSON.parse(b64decode(decodeURIComponent(raw))) as Record<string, string>
      for (const k of SESSION_KEYS) {
        if (typeof bag[k] === "string") window.localStorage.setItem(k, bag[k])
      }
      imported = !!window.localStorage.getItem(TOKEN_KEY)
    }
  } catch {
    // Ignore a malformed handoff — fall through to the normal (unauthenticated) flow.
  }
  // Always strip the fragment so the token never lingers in the URL / history.
  try {
    window.history.replaceState(null, "", window.location.pathname + window.location.search)
  } catch {
    /* no-op */
  }
  return imported
}

/**
 * Per-origin sessions: after a handoff is imported, the origin still holds the
 * LAUNCHING origin's refresh token. Exchange it for a brand-new, INDEPENDENT
 * access + refresh token dedicated to THIS origin, so rotating this origin's
 * token never invalidates the launching origin (or any other workspace).
 *
 * Returns the new { accessToken, refreshToken } (also written to localStorage),
 * or null if the exchange could not be completed (the handed-off session keeps
 * working in that case — no worse than before).
 */
export async function exchangeHandoffSession(): Promise<{ accessToken: string; refreshToken: string } | null> {
  if (typeof window === "undefined") return null
  try {
    const presented =
      window.localStorage.getItem(REFRESH_KEY) || window.localStorage.getItem(TOKEN_KEY)
    if (!presented) return null
    const res = await fetch("/api/core/auth/session-exchange", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: presented }),
    })
    if (!res.ok) return null
    const data = await res.json()
    if (!data?.success || !data.data?.accessToken || !data.data?.refreshToken) return null
    window.localStorage.setItem(TOKEN_KEY, data.data.accessToken)
    window.localStorage.setItem(REFRESH_KEY, data.data.refreshToken)
    return { accessToken: data.data.accessToken, refreshToken: data.data.refreshToken }
  } catch {
    return null
  }
}
