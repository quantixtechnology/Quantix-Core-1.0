"use client"

// ============================================================================
// Business Context Hook
//
// Resolution priority (first match wins):
//   1. adminStore.currentBusinessId  — super admin explicit impersonation
//   2. authStore.currentBusinessId   — authenticated business owner session
//   3. Slug lookup from demoBusinessId — dev / demo switcher mode
//   4. Empty string                  — no context (super admin, no selection)
//
// NOTE: localStorage is NOT used as a fallback. Stale localStorage caused
// "business not found" errors when the DB was re-seeded. The slug cache is
// in-memory (cleared on page refresh) so it's always fresh per session.
// ============================================================================

import { useState, useEffect, useCallback } from "react"
import { useAdminStore, getSlugForDemoId } from "@/stores/admin-store"
import { useAuthStore } from "@/stores/auth-store"
import { setBusinessContext } from "@/lib/api-client"

// In-memory slug → real DB ID cache. Clears on page refresh — intentionally.
const slugCache: Record<string, string> = {}

export function useBusinessContext() {
  const {
    currentBusinessId: adminBusinessId,
    demoBusinessId,
    currentBusinessSlug,
    setCurrentBusinessId,
  } = useAdminStore()

  const {
    currentBusinessId: authBusinessId,
    currentBusinessName: authBusinessName,
    isAuthenticated,
  } = useAuthStore()

  // Synchronous initial value from whichever store already has data
  const [resolvedId, setResolvedId] = useState<string>(
    () => adminBusinessId || authBusinessId || ""
  )
  const [businessName, setBusinessName] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resolveBusinessId = useCallback(async () => {
    // ── 1. Super admin explicit impersonation ─────────────────────────────
    if (adminBusinessId) {
      setResolvedId(adminBusinessId)
      setBusinessContext(adminBusinessId)
      setIsLoading(false)
      return
    }

    // ── 2. Authenticated business owner session ────────────────────────────
    if (isAuthenticated && authBusinessId) {
      setResolvedId(authBusinessId)
      setBusinessContext(authBusinessId)
      if (authBusinessName) setBusinessName(authBusinessName)
      setIsLoading(false)
      return
    }

    // ── 3. Demo / dev mode: resolve slug → real DB ID ─────────────────────
    const slug = currentBusinessSlug || getSlugForDemoId(demoBusinessId)
    if (slug) {
      // In-memory cache hit — avoids redundant fetches within a session
      if (slugCache[slug]) {
        const cached = slugCache[slug]
        setResolvedId(cached)
        setBusinessContext(cached)
        setCurrentBusinessId(cached)
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setError(null)
      try {
        const res = await fetch(
          `/api/core/businesses?slug=${encodeURIComponent(slug)}&limit=1`
        )
        const data = await res.json()
        const biz = Array.isArray(data.data) ? data.data[0] : data.data
        if (data.success && biz?.id) {
          slugCache[slug] = biz.id
          setResolvedId(biz.id)
          setBusinessName(biz.name ?? "")
          setBusinessContext(biz.id)
          setCurrentBusinessId(biz.id) // cache in admin store for this session
        } else {
          setError(`Business not found for slug: ${slug}`)
          setResolvedId("")
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to resolve business")
        setResolvedId("")
      } finally {
        setIsLoading(false)
      }
      return
    }

    // ── 4. No context — super admin with no business selected ─────────────
    setResolvedId("")
    setIsLoading(false)
  }, [
    adminBusinessId,
    authBusinessId,
    authBusinessName,
    isAuthenticated,
    demoBusinessId,
    currentBusinessSlug,
    setCurrentBusinessId,
  ])

  useEffect(() => {
    resolveBusinessId()
  }, [resolveBusinessId])

  return {
    businessId: resolvedId,
    isLoading,
    error,
    businessName,
    refetch: resolveBusinessId,
  }
}
