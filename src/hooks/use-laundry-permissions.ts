"use client"

// Laundry OS permission hook — the single client source for "can this user do X".
// Reads the same /api/laundry/rbac/me the sidebar uses (owner ⇒ all). Used to
// hide buttons/actions the user lacks. Server APIs still enforce (403); this is
// presentation only. Cached per business so multiple components share one fetch.
import { useEffect, useState } from "react"
import { useAuthStore } from "@/stores/auth-store"

type Snapshot = { isOwner: boolean; perms: Set<string>; roleCode: string }
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
      // API returns `levels` (Record<string, number>) — convert to Set of screen keys with VIEW+ level
      const levels: Record<string, number> = r.data.levels || {}
      const perms = new Set(Object.keys(levels).filter((k) => (levels[k] ?? 0) >= 1))
      const snap: Snapshot = { isOwner: !!r.data.isOwner, perms, roleCode: String(r.data.roleCode || "") }
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
  // Platform Super Admin, as resolved server-side by /api/laundry/rbac/me. Used
  // only to reveal platform-administrator actions (e.g. deleting a staff user);
  // the endpoints themselves re-verify. Unlike `can`, this defaults to FALSE
  // while loading — a platform-only action must never flash into view for a
  // tenant user.
  const isPlatformSuperAdmin = snap?.roleCode === "QUANTIX_SUPER_ADMIN"
  // While permissions are still loading (snap === null) we allow, so the UI never
  // flashes "no access" for a legitimately-permitted user; the server enforces.
  const can = (key: string) => snap === null || isOwner || snap.perms.has(key)
  return { can, isOwner, isPlatformSuperAdmin, loading: snap === null }
}
