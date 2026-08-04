"use client"

import { createContext, useEffect, useState, useRef, useCallback, type ReactNode } from "react"
import { useAuthStore } from "@/stores/auth-store"
import type { RuntimeAuth } from "@/lib/runtime-auth"
import { UNAUTHORIZED } from "@/lib/runtime-auth"

export const RuntimeAuthContext = createContext<RuntimeAuth>(UNAUTHORIZED)

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

interface CacheEntry {
  data: RuntimeAuth
  ts: number
}

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
      platformRole: "",
    }
  } catch {
    return null
  }
}

const cache = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<RuntimeAuth | null>>()

function isCacheValid(businessId: string): boolean {
  const entry = cache.get(businessId)
  if (!entry) return false
  return Date.now() - entry.ts < CACHE_TTL
}

export function getRuntimeAuth(businessId: string): Promise<RuntimeAuth | null> {
  if (isCacheValid(businessId)) return Promise.resolve(cache.get(businessId)!.data)
  if (inflight.has(businessId)) return inflight.get(businessId)!
  const p = fetchRbac(businessId).then((r) => {
    inflight.delete(businessId)
    if (r) cache.set(businessId, { data: r, ts: Date.now() })
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
    const role = currentRole || user?.role || ""
    // platformRole is populated ONLY from User.platformRole (null for tenant
    // users → ""). The legacy BusinessUser.role (currentRole) must never be
    // substituted here — it is isolated to legacy compatibility.
    const platformRole = user?.platformRole ?? ""
    if (currentBusinessId && isCacheValid(currentBusinessId)) {
      const entry = cache.get(currentBusinessId)!
      return { ...entry.data, businessRole: role, platformRole }
    }
    return { ...UNAUTHORIZED, businessRole: role, platformRole }
  })
  const lastBizId = useRef(currentBusinessId)
  const lastRole = useRef<string | null>(currentRole)
  const lastPlatformRole = useRef<string>(user?.platformRole ?? "")
  const mounted = useRef(true)

  const doFetch = useCallback((id: string, role: string, platformRole: string) => {
    fetchRbac(id).then((r) => {
      if (!mounted.current) return
      if (r) {
        const merged: RuntimeAuth = { ...r, businessRole: role, platformRole }
        cache.set(id, { data: merged, ts: Date.now() })
        setAuth(merged)
      } else {
        // On fetch failure, set loaded=true with empty role so components
        // don't fall back to legacy BusinessUser.role
        setAuth((prev) => ({
          ...prev,
          businessRole: role,
          platformRole,
          isLoaded: true,
          assignedRbacRole: prev.assignedRbacRole || "",
        }))
      }
    })
  }, [])

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    if (!currentBusinessId) return
    const id = currentBusinessId
    const role = currentRole || user?.role || ""
    const platformRole = user?.platformRole ?? ""

    if (id !== lastBizId.current || !isCacheValid(id)) {
      lastBizId.current = id
      if (isCacheValid(id)) {
        const entry = cache.get(id)!
        setAuth({ ...entry.data, businessRole: role, platformRole })
      } else {
        doFetch(id, role, platformRole)
      }
    } else if (role !== lastRole.current || platformRole !== lastPlatformRole.current) {
      lastRole.current = role
      lastPlatformRole.current = platformRole
      setAuth((prev) => ({ ...prev, businessRole: role, platformRole }))
    }
  }, [currentBusinessId, currentRole, user?.role, user?.platformRole, doFetch])

  return (
    <RuntimeAuthContext.Provider value={auth}>
      {children}
    </RuntimeAuthContext.Provider>
  )
}
