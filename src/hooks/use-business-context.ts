"use client"

// ============================================================================
// Business Context Hook
// Resolves the real database business ID from the admin store's currentBusinessId
// or by looking up the business slug from the API.
// ============================================================================

import { useState, useEffect, useCallback } from "react"
import { useAdminStore, getSlugForDemoId } from "@/stores/admin-store"
import { setBusinessContext, getBusinessContextId } from "@/lib/api-client"

// Cache of slug -> businessId mappings
const slugCache: Record<string, string> = {}

/**
 * Hook to get the real database business ID for the current business context.
 * 
 * Returns:
 * - businessId: The real database business ID (cuid), or empty string if not resolved yet
 * - isLoading: Whether we're currently resolving the business ID
 * - error: Any error that occurred during resolution
 * - businessName: The resolved business name
 */
export function useBusinessContext() {
  const { currentBusinessId, demoBusinessId, currentBusinessSlug } = useAdminStore()
  const [resolvedId, setResolvedId] = useState<string>(currentBusinessId || "")
  const [businessName, setBusinessName] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resolveBusinessId = useCallback(async () => {
    // If we already have a real business ID (cuid format, starts with "cmp" or similar), use it
    if (currentBusinessId && currentBusinessId.length > 10 && currentBusinessId !== "biz_1") {
      setResolvedId(currentBusinessId)
      setBusinessContext(currentBusinessId)
      setIsLoading(false)
      return
    }

    // Try to get from localStorage (set by auth store)
    const storedBusinessId = getBusinessContextId()
    if (storedBusinessId && storedBusinessId.length > 10) {
      setResolvedId(storedBusinessId)
      setBusinessContext(storedBusinessId)
      setIsLoading(false)
      return
    }

    // Try to resolve by slug
    const slug = currentBusinessSlug || getSlugForDemoId(demoBusinessId)
    if (!slug) {
      // Super admin — no business context
      setResolvedId("")
      setIsLoading(false)
      return
    }

    // Check cache
    if (slugCache[slug]) {
      setResolvedId(slugCache[slug])
      setBusinessContext(slugCache[slug])
      setIsLoading(false)
      return
    }

    // Fetch from API
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/core/businesses?slug=${encodeURIComponent(slug)}&limit=1`)
      const data = await response.json()
      if (data.success && data.data && Array.isArray(data.data) && data.data.length > 0) {
        const biz = data.data[0]
        slugCache[slug] = biz.id
        setResolvedId(biz.id)
        setBusinessName(biz.name)
        setBusinessContext(biz.id)
      } else if (data.success && data.data && !Array.isArray(data.data)) {
        // Single business response
        const biz = data.data
        slugCache[slug] = biz.id
        setResolvedId(biz.id)
        setBusinessName(biz.name)
        setBusinessContext(biz.id)
      } else {
        setError(`Business not found for slug: ${slug}`)
        setResolvedId("")
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to resolve business ID"
      setError(message)
      setResolvedId("")
    } finally {
      setIsLoading(false)
    }
  }, [currentBusinessId, demoBusinessId, currentBusinessSlug])

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
