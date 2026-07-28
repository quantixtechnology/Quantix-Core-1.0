"use client"

import { createContext, useEffect, useState, useRef, type ReactNode } from "react"
import { useAuthStore } from "@/stores/auth-store"
import type { RuntimeAuth } from "@/lib/runtime-auth"
import { UNAUTHORIZED } from "@/lib/runtime-auth"

export const RuntimeAuthContext = createContext<RuntimeAuth>(UNAUTHORIZED)

async function fetchRbac(businessId: string): Promise<RuntimeAuth | null> {
  try {
    const res = await fetch(`/api/laundry/rbac/me?businessId=${businessId}`)
    const json = await res.json()
    if (!json.success) return null

    const { roleCode, isOwner, levels } = json.data as {
      roleCode: string
      isOwner: boolean
      levels: Record<string, number>
    }

    return {
      businessRole: "",
      assignedRbacRole: roleCode || "",
      screenLevels: levels || {},
      isOwner,
      isLoaded: true,
    }
  } catch {
    return null
  }
}

const cache = new Map<string, RuntimeAuth>()
const inflight = new Map<string, Promise<RuntimeAuth | null>>()

export function getRuntimeAuth(businessId: string): Promise<RuntimeAuth | null> {
  if (cache.has(businessId)) return Promise.resolve(cache.get(businessId)!)
  if (inflight.has(businessId)) return inflight.get(businessId)!
  const p = fetchRbac(businessId).then((r) => {
    if (r) cache.set(businessId, r)
    inflight.delete(businessId)
    return r
  })
  inflight.set(businessId, p)
  return p
}

export function clearRuntimeAuthCache(businessId?: string) {
  if (businessId) cache.delete(businessId)
  else cache.clear()
}

export function RuntimeAuthProvider({ children }: { children: ReactNode }) {
  const { currentBusinessId, currentRole, user } = useAuthStore()
  const [auth, setAuth] = useState<RuntimeAuth>(() => {
    if (currentBusinessId && cache.has(currentBusinessId)) return cache.get(currentBusinessId)!
    return { ...UNAUTHORIZED, businessRole: currentRole || user?.role || "" }
  })
  const lastBizId = useRef(currentBusinessId)
  const lastRole = useRef<string | null>(currentRole)

  useEffect(() => {
    if (!currentBusinessId) return
    const id = currentBusinessId
    const role = currentRole || user?.role || ""

    // Only refetch when businessId changes; role changes just update the cached value
    if (id !== lastBizId.current) {
      lastBizId.current = id
      if (cache.has(id)) {
        const cached = cache.get(id)!
        setAuth({ ...cached, businessRole: role })
        return
      }
      fetchRbac(id).then((r) => {
        if (r) setAuth({ ...r, businessRole: role })
      })
    } else if (role !== lastRole.current) {
      lastRole.current = role
      setAuth((prev) => ({ ...prev, businessRole: role }))
    }
  }, [currentBusinessId, currentRole, user?.role])

  return (
    <RuntimeAuthContext.Provider value={auth}>
      {children}
    </RuntimeAuthContext.Provider>
  )
}
