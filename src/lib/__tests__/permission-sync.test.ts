import { describe, it, expect } from "vitest"
import {
  normalizePermKey,
  isLivePermissionKey,
  isLiveNavScreenKey,
  isObsoletePermissionKey,
  findOrphanRegisteredScreens,
  buildSyncReport,
  WORKSTATION_SCREEN_KEYS,
  OBSOLETE_SCREEN_KEYS,
} from "@/lib/permission-sync"
import { allScreenKeys, isValidScreenKey, screenLabel } from "@/lib/laundry-rbac-registry"
import { defaultNavigationConfig, SCREEN_PAGE_MAP } from "@/lib/laundry-nav-config"

// ============================================================================
// PERMISSION SYNC ENGINE — registry ↔ navigation ↔ roles consistency
// ============================================================================

describe("permission-sync: obsolete keys", () => {
  it("obsolete keys are exactly the retired processing screens", () => {
    expect(OBSOLETE_SCREEN_KEYS.sort()).toEqual(["processing.drying", "processing.packing"])
  })

  it("obsolete keys are no longer registered in the registry", () => {
    for (const key of OBSOLETE_SCREEN_KEYS) {
      expect(isValidScreenKey(key)).toBe(false)
      expect(allScreenKeys().includes(key)).toBe(false)
    }
  })

  it("obsolete keys are flagged as not live / obsolete", () => {
    for (const key of OBSOLETE_SCREEN_KEYS) {
      expect(isLivePermissionKey(key)).toBe(false)
      expect(isObsoletePermissionKey(key)).toBe(true)
    }
  })
})

describe("permission-sync: canonical processing screens", () => {
  it("every canonical workstation screen is registered and live", () => {
    expect(WORKSTATION_SCREEN_KEYS).toEqual([
      "processing.console_receive",
      "processing.audit_barcode",
      "processing.washing",
      "processing.dry_cleaning",
      "processing.quality_check",
      "processing.sorting",
      "processing.ironing",
      "processing.folding",
      "processing.transit",
    ])
    for (const key of WORKSTATION_SCREEN_KEYS) {
      expect(isValidScreenKey(key)).toBe(true)
      expect(isLivePermissionKey(key)).toBe(true)
      expect(isLiveNavScreenKey(key)).toBe(true)
    }
  })

  it("quality_check is the merged Dry & Quality Check screen", () => {
    expect(screenLabel("processing.quality_check")).toBe("Dry & Quality Check")
    expect(isValidScreenKey("processing.quality_check")).toBe(true)
  })
})

describe("permission-sync: normalization", () => {
  it("normalizes legacy action keys to their screen key", () => {
    expect(normalizePermKey("processing.washing.process")).toBe("processing.washing")
    expect(normalizePermKey("processing.quality_check.override")).toBe("processing.quality_check")
    expect(normalizePermKey("processing.washing")).toBe("processing.washing")
  })

  it("normalizing an obsolete key keeps it obsolete", () => {
    expect(isLivePermissionKey("processing.drying.process")).toBe(false)
    expect(isObsoletePermissionKey("processing.drying.process")).toBe(true)
    expect(isLivePermissionKey("processing.packing.return_queue")).toBe(false)
  })

  it("bare registered screens normalize to themselves and stay live", () => {
    for (const sk of allScreenKeys()) {
      expect(normalizePermKey(sk)).toBe(sk)
      expect(isLivePermissionKey(sk)).toBe(true)
    }
  })
})

describe("permission-sync: nav screen keys", () => {
  it("every default nav screen key is live", () => {
    const navKeys = defaultNavigationConfig().flatMap((s) => s.items.map((i) => i.screenKey))
    for (const k of navKeys) {
      expect(isLiveNavScreenKey(k)).toBe(true)
    }
  })

  it("obsolete processing keys are not live nav keys", () => {
    expect(isLiveNavScreenKey("processing.drying")).toBe(false)
    expect(isLiveNavScreenKey("processing.packing")).toBe(false)
  })

  it("every SCREEN_PAGE_MAP key is live", () => {
    for (const k of Object.keys(SCREEN_PAGE_MAP)) {
      expect(isLiveNavScreenKey(k)).toBe(true)
    }
  })

  it("garbage / unknown nav keys are flagged as orphans", () => {
    expect(isLiveNavScreenKey("processing.bogus")).toBe(false)
    expect(isLiveNavScreenKey("")).toBe(false)
  })
})

describe("permission-sync: registry ↔ nav cross-check", () => {
  it("every default nav screen maps to a registered screen (no nav orphans)", () => {
    const navKeys = defaultNavigationConfig().flatMap((s) => s.items.map((i) => i.screenKey))
    const report = buildSyncReport([], navKeys)
    expect(report.orphanNavKeys).toEqual([])
  })

  it("no registered screen is an unreachable orphan (excl. mobile/programmatic)", () => {
    expect(findOrphanRegisteredScreens()).toEqual([])
  })

  it("a snapshot containing obsolete keys reports them as orphans", () => {
    const report = buildSyncReport(
      ["processing.drying", "processing.packing", "processing.washing", "processing.quality_check"],
      ["processing.drying", "processing.washing", "processing.transit"],
    )
    expect(report.orphanPermissions.sort()).toEqual(["processing.drying", "processing.packing"])
    expect(report.orphanNavKeys).toEqual(["processing.drying"])
    expect(report.totalScreens).toBe(allScreenKeys().length)
    expect(report.totalNavItems).toBe(3)
  })

  it("a clean snapshot has zero orphans and zero obsolete keys", () => {
    const navKeys = defaultNavigationConfig().flatMap((s) => s.items.map((i) => i.screenKey))
    const report = buildSyncReport(allScreenKeys(), navKeys)
    expect(report.orphanPermissions).toEqual([])
    expect(report.orphanNavKeys).toEqual([])
    for (const k of report.orphanPermissions) expect(OBSOLETE_SCREEN_KEYS).not.toContain(k)
  })

  it("every registered screen maps to a sidebar permission or is mobile/programmatic", () => {
    const navKeys = defaultNavigationConfig().flatMap((s) => s.items.map((i) => i.screenKey))
    const permsFromNav = [...new Set(navKeys)]
    const mobileOnly = ["customer_app.customers", "customer_app.invitation", "customer_app.subscription", "customer_app.orders"]
    const programmatic = ["laundry.order_detail", "laundry.inbox", "laundry.subscription_plans", "laundry.charges_rules", "laundry.pricing_simulator"]
    const uncovered: string[] = []
    for (const sk of allScreenKeys()) {
      if (mobileOnly.includes(sk) || programmatic.includes(sk)) continue
      if (!permsFromNav.includes(sk)) uncovered.push(sk)
    }
    expect(uncovered).toEqual([])
  })
})
