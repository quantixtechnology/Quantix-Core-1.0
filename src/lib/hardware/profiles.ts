// Device profiles — which physical printer serves which role, per store.
//
// Stored in localStorage, deliberately. A printer is attached to a counter, not
// to a company: the barcode printer at Thanisandra is a different box from the
// one at Whitefield, and even two terminals in one store can have different
// hardware. Browser-scoped storage is the only place that describes the
// terminal you are standing at, and it keeps this feature additive — no schema
// change, nothing to migrate, nothing that can break an existing workflow.
//
// The store id is part of the key so one shared back-office machine can hold a
// separate profile per store it serves.

import type { PrinterRole } from "./types"

const KEY_PREFIX = "qx-hardware-profile-v1"

export interface DeviceProfile {
  storeId: string | null
  storeName?: string | null
  /** Printer role → device id from the registry. */
  printers: Partial<Record<PrinterRole, string>>
  /** Free-text label stock note for the barcode printer, e.g. "60 × 40 mm". */
  labelSize?: string | null
  updatedAt?: string
}

const key = (storeId: string | null) => `${KEY_PREFIX}:${storeId || "default"}`

const empty = (storeId: string | null): DeviceProfile => ({ storeId, printers: {}, labelSize: null })

export function loadProfile(storeId: string | null): DeviceProfile {
  if (typeof window === "undefined") return empty(storeId)
  try {
    const raw = window.localStorage.getItem(key(storeId))
    if (!raw) return empty(storeId)
    const p = JSON.parse(raw) as DeviceProfile
    return { ...empty(storeId), ...p, printers: p.printers || {} }
  } catch {
    return empty(storeId)
  }
}

const listeners = new Set<(p: DeviceProfile) => void>()

export function saveProfile(p: DeviceProfile): DeviceProfile {
  const next = { ...p, updatedAt: new Date().toISOString() }
  if (typeof window !== "undefined") {
    try { window.localStorage.setItem(key(p.storeId), JSON.stringify(next)) } catch { /* private mode — defaults fall back to browser print */ }
  }
  listeners.forEach((l) => l(next))
  return next
}

export function subscribeProfile(fn: (p: DeviceProfile) => void) {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

export function setRole(storeId: string | null, role: PrinterRole, deviceId: string | null): DeviceProfile {
  const p = loadProfile(storeId)
  const printers = { ...p.printers }
  if (deviceId) printers[role] = deviceId
  else delete printers[role]
  return saveProfile({ ...p, printers })
}

/**
 * The device bound to a role, or null to mean "no preference" — which the
 * PrintEngine reads as ordinary browser printing. An unconfigured terminal is
 * a working terminal.
 */
export function deviceForRole(storeId: string | null, role: PrinterRole): string | null {
  return loadProfile(storeId).printers[role] ?? null
}

/** Every profile this browser holds, for the Hardware Manager's profile list. */
export function listProfiles(): DeviceProfile[] {
  if (typeof window === "undefined") return []
  const out: DeviceProfile[] = []
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i)
      if (!k?.startsWith(`${KEY_PREFIX}:`)) continue
      const raw = window.localStorage.getItem(k)
      if (raw) out.push(JSON.parse(raw) as DeviceProfile)
    }
  } catch { /* unreadable storage — show nothing rather than crash the page */ }
  return out
}
