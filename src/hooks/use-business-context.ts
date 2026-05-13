"use client"

// ============================================================================
// Business Context Hook
//
// Resolution priority (first match wins):
//   1. adminStore.currentBusinessId  — super admin impersonating a business
//   2. authStore.currentBusinessId   — authenticated business owner session
//   3. Empty string                  — no context (super admin, no selection)
// ============================================================================

import { useState, useEffect, useCallback } from "react"
import { useAdminStore } from "@/stores/admin-store"
import { useAuthStore } from "@/stores/auth-store"
import { setBusinessContext } from "@/lib/api-client"

export function useBusinessContext() {
  const {
    currentBusinessId: adminBusinessId,
    currentBusinessName: adminBusinessName,
  } = useAdminStore()

  const {
    currentBusinessId: authBusinessId,
    currentBusinessName: authBusinessName,
    isAuthenticated,
  } = useAuthStore()

  const getResolvedId = useCallback(() => {
    if (adminBusinessId) return adminBusinessId
    if (isAuthenticated && authBusinessId) return authBusinessId
    return ""
  }, [adminBusinessId, authBusinessId, isAuthenticated])

  const [resolvedId, setResolvedId] = useState<string>(getResolvedId)
  const [businessName, setBusinessName] = useState<string>("")
  const [isLoading] = useState(false)
  const [error] = useState<string | null>(null)

  useEffect(() => {
    if (adminBusinessId) {
      setResolvedId(adminBusinessId)
      setBusinessContext(adminBusinessId)
      setBusinessName(adminBusinessName || "")
      return
    }

    if (isAuthenticated && authBusinessId) {
      setResolvedId(authBusinessId)
      setBusinessContext(authBusinessId)
      setBusinessName(authBusinessName || "")
      return
    }

    setResolvedId("")
    setBusinessName("")
  }, [adminBusinessId, adminBusinessName, authBusinessId, authBusinessName, isAuthenticated])

  return {
    businessId: resolvedId,
    isLoading,
    error,
    businessName,
    refetch: () => {
      const id = getResolvedId()
      setResolvedId(id)
      if (id) setBusinessContext(id)
    },
  }
}
