import { describe, it, expect } from "vitest"
import { isValidScreenKey, Level } from "@/lib/laundry-rbac-registry"
import { SYSTEM_ROLES } from "@/lib/laundry-rbac-catalog"
import {
  DASHBOARD_STAGE_PERMS,
  PROCESSING_ANY,
  dashboardDeliveryVisible,
  dashboardHasAnyWidget,
  dashboardNewOrderVisible,
  dashboardOrderStatsVisible,
  dashboardPickupVisible,
  dashboardStatusVisible,
  filterStatuses,
  hasAnyProcessing,
} from "@/lib/laundry-dashboard-perms"

// The Store Counter dashboard renders exactly these workload statuses — every
// one MUST declare its required permission(s) in DASHBOARD_STAGE_PERMS.
const STORE_COUNTER_STATUSES = [
  "PENDING_STORE_AUDIT",
  "PAYMENT_PENDING",
  "READY_FOR_PROCESSING",
  "PACKED",
  "IN_TRANSIT_TO_PROCESSING",
  "PROCESSING",
  "RETURN_IN_TRANSIT",
  "READY_FOR_DELIVERY",
  "DELIVERED",
]

function roleLevels(code: string): Map<string, number> {
  const role = SYSTEM_ROLES.find((r) => r.code === code)
  if (!role) throw new Error(`Unknown system role: ${code}`)
  return new Map(role.screens().map((sl) => [sl.screenKey, sl.level]))
}

function levelsMap(entries: [string, number][]): Map<string, number> {
  return new Map(entries)
}

describe("laundry-dashboard-perms mapping integrity", () => {
  it("covers every Store Counter workload status", () => {
    for (const s of STORE_COUNTER_STATUSES) {
      expect(DASHBOARD_STAGE_PERMS[s], `missing perm for ${s}`).toBeDefined()
    }
  })

  it("every non-wildcard permission is a valid registered screen key", () => {
    for (const [status, perms] of Object.entries(DASHBOARD_STAGE_PERMS)) {
      for (const p of perms) {
        if (p === PROCESSING_ANY) continue
        expect(isValidScreenKey(p), `${status} -> ${p} is not registered`).toBe(true)
      }
    }
  })
})

describe("Store Counter widget visibility by role", () => {
  it("CRM Manager sees NO operational widgets, KPIs, New Order, or field ops", () => {
    const levels = roleLevels("CRM_MANAGER")
    for (const s of STORE_COUNTER_STATUSES) {
      expect(dashboardStatusVisible(levels, s), `CRM_MANAGER must not see ${s}`).toBe(false)
    }
    expect(dashboardHasAnyWidget(levels)).toBe(false)
    expect(dashboardOrderStatsVisible(levels)).toBe(false)
    expect(dashboardNewOrderVisible(levels)).toBe(false)
    expect(dashboardPickupVisible(levels)).toBe(false)
    expect(dashboardDeliveryVisible(levels)).toBe(false)
  })

  it("Business Owner sees every widget, KPIs, New Order, and field ops", () => {
    const levels = roleLevels("BUSINESS_OWNER")
    for (const s of STORE_COUNTER_STATUSES) {
      expect(dashboardStatusVisible(levels, s), `owner must see ${s}`).toBe(true)
    }
    expect(dashboardHasAnyWidget(levels)).toBe(true)
    expect(dashboardOrderStatsVisible(levels)).toBe(true)
    expect(dashboardNewOrderVisible(levels)).toBe(true)
    expect(dashboardPickupVisible(levels)).toBe(true)
    expect(dashboardDeliveryVisible(levels)).toBe(true)
  })

  it("Delivery Executive sees only Ready for Delivery and Return in Transit", () => {
    const levels = roleLevels("DELIVERY_EXECUTIVE")
    expect(dashboardStatusVisible(levels, "READY_FOR_DELIVERY")).toBe(true)
    expect(dashboardStatusVisible(levels, "RETURN_IN_TRANSIT")).toBe(true)
    expect(dashboardStatusVisible(levels, "PACKED")).toBe(false)
    expect(dashboardStatusVisible(levels, "PENDING_STORE_AUDIT")).toBe(false)
    expect(dashboardStatusVisible(levels, "PROCESSING")).toBe(false)
    expect(dashboardOrderStatsVisible(levels)).toBe(false)
    expect(dashboardPickupVisible(levels)).toBe(false)
    expect(dashboardDeliveryVisible(levels)).toBe(false)
  })

  it("Processing Staff sees only In Transit to PC and In Processing (wildcard)", () => {
    const levels = roleLevels("PROCESSING_STAFF")
    expect(hasAnyProcessing(levels)).toBe(true)
    expect(dashboardStatusVisible(levels, "IN_TRANSIT_TO_PROCESSING")).toBe(true)
    expect(dashboardStatusVisible(levels, "PROCESSING")).toBe(true)
    expect(dashboardStatusVisible(levels, "READY_FOR_DELIVERY")).toBe(false)
    expect(dashboardStatusVisible(levels, "PACKED")).toBe(false)
    expect(dashboardOrderStatsVisible(levels)).toBe(false)
  })

  it("Counter Executive sees counter-stage widgets, order KPIs, and field ops", () => {
    const levels = roleLevels("COUNTER_EXECUTIVE")
    expect(dashboardStatusVisible(levels, "PENDING_STORE_AUDIT")).toBe(true)
    expect(dashboardStatusVisible(levels, "PAYMENT_PENDING")).toBe(true)
    expect(dashboardStatusVisible(levels, "READY_FOR_PROCESSING")).toBe(true)
    expect(dashboardStatusVisible(levels, "PACKED")).toBe(true)
    expect(dashboardStatusVisible(levels, "PROCESSING")).toBe(false)
    expect(dashboardStatusVisible(levels, "READY_FOR_DELIVERY")).toBe(false)
    expect(dashboardOrderStatsVisible(levels)).toBe(true)
    expect(dashboardNewOrderVisible(levels)).toBe(true)
    expect(dashboardPickupVisible(levels)).toBe(true)
    expect(dashboardDeliveryVisible(levels)).toBe(true)
  })

  // REVERSED: Accountant is now a FULL-ACCESS role, so the whole dashboard is
  // visible rather than the money-only subset.
  it("Accountant sees the whole dashboard", () => {
    const levels = roleLevels("ACCOUNTANT")
    expect(dashboardStatusVisible(levels, "DELIVERED")).toBe(true)
    expect(dashboardStatusVisible(levels, "PAYMENT_PENDING")).toBe(true)
    expect(dashboardStatusVisible(levels, "PACKED")).toBe(true)
    expect(dashboardStatusVisible(levels, "READY_FOR_DELIVERY")).toBe(true)
    expect(dashboardStatusVisible(levels, "PROCESSING")).toBe(true)
    expect(dashboardOrderStatsVisible(levels)).toBe(true)
    expect(dashboardPickupVisible(levels)).toBe(true)
    expect(dashboardDeliveryVisible(levels)).toBe(true)
  })

  it("dashboardStatusVisible returns false for unknown/unregistered statuses", () => {
    expect(dashboardStatusVisible(new Map(), "CANCELLED")).toBe(false)
    expect(dashboardStatusVisible(new Map(), "SOMETHING_NEW")).toBe(false)
  })
})

describe("filterStatuses", () => {
  const all = {
    PENDING_STORE_AUDIT: 3,
    PAYMENT_PENDING: 2,
    READY_FOR_PROCESSING: 5,
    PACKED: 4,
    IN_TRANSIT_TO_PROCESSING: 6,
    PROCESSING: 8,
    RETURN_IN_TRANSIT: 7,
    READY_FOR_DELIVERY: 9,
    DELIVERED: 11,
    CANCELLED: 1,
  }

  it("strips statuses the caller cannot view and drops unknown statuses", () => {
    const filtered = filterStatuses(roleLevels("DELIVERY_EXECUTIVE"), all)
    expect(filtered).toEqual({ RETURN_IN_TRANSIT: 7, READY_FOR_DELIVERY: 9 })
  })

  it("returns an empty object when nothing is visible", () => {
    expect(filterStatuses(roleLevels("CRM_MANAGER"), all)).toEqual({})
  })

  it("owner retains every registered status but still drops unknown ones", () => {
    const filtered = filterStatuses(roleLevels("BUSINESS_OWNER"), all)
    expect(filtered["PENDING_STORE_AUDIT"]).toBe(3)
    expect(filtered["DELIVERED"]).toBe(11)
    expect("CANCELLED" in filtered).toBe(false)
  })

  it("works with a plain Record of levels (client screenLevels shape)", () => {
    const record = { "store_ops.ready_for_delivery": Level.CREATE, "store_ops.transit": Level.CREATE }
    expect(dashboardStatusVisible(record, "READY_FOR_DELIVERY")).toBe(true)
    expect(dashboardStatusVisible(record, "PACKED")).toBe(false)
    expect(hasAnyProcessing(record)).toBe(false)
  })

  it("minimum VIEW level is required (HIDE does not grant visibility)", () => {
    const hidden = levelsMap([["store_ops.store_audit", Level.HIDE]])
    expect(dashboardStatusVisible(hidden, "PENDING_STORE_AUDIT")).toBe(false)
    const view = levelsMap([["store_ops.store_audit", Level.VIEW]])
    expect(dashboardStatusVisible(view, "PENDING_STORE_AUDIT")).toBe(true)
  })
})
