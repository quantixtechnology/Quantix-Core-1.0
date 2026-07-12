"use client"

// Laundry OS permission hook — the single client source for "can this user do X".
// Reads the same /api/laundry/rbac/me the sidebar uses (owner ⇒ all). Used to
// hide buttons/actions the user lacks. Server APIs still enforce (403); this is
// presentation only. Cached per business so multiple components share one fetch.
import { useEffect, useState } from "react"
import { useAuthStore } from "@/stores/auth-store"

type Snapshot = { isOwner: boolean; perms: Set<string> }
const cache = new Map<string, Snapshot>()
const inflight = new Map<string, Promise<Snapshot | null>>()
const listeners = new Set<() => void>()

async function fetchPerms(businessId: string): Promise<Snapshot | null> {
  if (cache.has(businessId)) return cache.get(businessId)!
  if (inflight.has(businessId)) return inflight.get(businessId)!
  const p = (async () => {
    try {
      const r = await fetch(`/api/laundry/rbac/me?businessId=${businessId}`).then((x) => x.json())
      if (!r.success) return null
      const snap: Snapshot = { isOwner: !!r.data.isOwner, perms: new Set<string>(r.data.permissions) }
      cache.set(businessId, snap)
      listeners.forEach((l) => l())
      return snap
    } catch { return null } finally { inflight.delete(businessId) }
  })()
  inflight.set(businessId, p)
  return p
}

// Force a re-fetch after a permission/role change so the UI updates without a
// reload (role changes take effect immediately server-side).
export function refreshLaundryPermissions(businessId?: string | null) {
  if (businessId) cache.delete(businessId)
  else cache.clear()
  listeners.forEach((l) => l())
}

export function useLaundryPermissions() {
  const { currentBusinessId } = useAuthStore()
  const [, force] = useState(0)
  const [snap, setSnap] = useState<Snapshot | null>(currentBusinessId ? cache.get(currentBusinessId) ?? null : null)

  useEffect(() => {
    const rerender = () => { force((n) => n + 1); if (currentBusinessId) setSnap(cache.get(currentBusinessId) ?? null) }
    listeners.add(rerender)
    if (currentBusinessId) fetchPerms(currentBusinessId).then((s) => { if (s) setSnap(s) })
    return () => { listeners.delete(rerender) }
  }, [currentBusinessId])

  const isOwner = snap?.isOwner ?? false
  // While permissions are still loading (snap === null) we allow, so the UI never
  // flashes "no access" for a legitimately-permitted user; the server enforces.
  const can = (key: string) => snap === null || isOwner || snap.perms.has(key)
  return { can, isOwner, loading: snap === null }
}
