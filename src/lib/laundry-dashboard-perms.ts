// ============================================================================
// Permission requirements for every Store Counter dashboard widget.
// Single source of truth shared by the frontend (render/fetch gating) and the
// backend (orders/stats payload filtering) so widgets and APIs can never drift.
//
// Map key = LaundryOrder status; value = list of RBAC screen keys required to
// see that widget. A widget is visible when the caller has VIEW (or higher) on
// ANY of its required keys. PROCESSING_ANY is a wildcard matching any screen in
// the processing module.
// ============================================================================

import { Level } from "@/lib/laundry-rbac-registry"

export type DashboardLevels = Map<string, number> | Record<string, number>

export const PROCESSING_ANY = "__processing_any__"

export const DASHBOARD_STAGE_PERMS: Record<string, string[]> = {
  PENDING_STORE_AUDIT: ["store_ops.store_audit"],
  PAYMENT_PENDING: ["store_ops.payment_collection"],
  READY_FOR_PROCESSING: ["store_ops.packing_qr"],
  PACKED: ["store_ops.dispatch_center"],
  IN_TRANSIT_TO_PROCESSING: [PROCESSING_ANY],
  PROCESSING: [PROCESSING_ANY],
  RETURN_IN_TRANSIT: ["store_ops.transit", "store_ops.store_receive"],
  READY_FOR_DELIVERY: ["store_ops.ready_for_delivery"],
  DELIVERED: ["laundry.orders"],
}

// Top KPI row (Today's/Total orders) + Customer Feedback — order-history data.
export const DASHBOARD_ORDER_STATS_PERMS = ["laundry.orders"]
export const DASHBOARD_NEW_ORDER_PERMS = ["laundry.new_order"]
export const DASHBOARD_PICKUP_PERMS = ["store_ops.pickup_scheduler"]
export const DASHBOARD_DELIVERY_PERMS = ["store_ops.delivery_assignments"]

function levelAt(levels: DashboardLevels, key: string): number {
  if (levels instanceof Map) return levels.get(key) ?? 0
  return levels[key] ?? 0
}

function visible(levels: DashboardLevels, screenKey: string): boolean {
  return levelAt(levels, screenKey) >= Level.VIEW
}

export function hasAnyProcessing(levels: DashboardLevels): boolean {
  const keys = levels instanceof Map ? [...levels.keys()] : Object.keys(levels)
  return keys.some((k) => k.startsWith("processing.") && levelAt(levels, k) >= Level.VIEW)
}

function granted(levels: DashboardLevels, perms: string[]): boolean {
  return perms.some((p) => (p === PROCESSING_ANY ? hasAnyProcessing(levels) : visible(levels, p)))
}

export function dashboardStatusVisible(levels: DashboardLevels, status: string): boolean {
  const perms = DASHBOARD_STAGE_PERMS[status]
  if (!perms) return false
  return granted(levels, perms)
}

export function dashboardOrderStatsVisible(levels: DashboardLevels): boolean {
  return granted(levels, DASHBOARD_ORDER_STATS_PERMS)
}

export function dashboardNewOrderVisible(levels: DashboardLevels): boolean {
  return granted(levels, DASHBOARD_NEW_ORDER_PERMS)
}

export function dashboardPickupVisible(levels: DashboardLevels): boolean {
  return granted(levels, DASHBOARD_PICKUP_PERMS)
}

export function dashboardDeliveryVisible(levels: DashboardLevels): boolean {
  return granted(levels, DASHBOARD_DELIVERY_PERMS)
}

export function dashboardHasAnyWidget(levels: DashboardLevels): boolean {
  return Object.keys(DASHBOARD_STAGE_PERMS).some((s) => dashboardStatusVisible(levels, s))
}

// Strip an aggregate down to the stages the caller may actually see.
export function filterStatuses(levels: DashboardLevels, byStatus: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [status, n] of Object.entries(byStatus)) {
    if (dashboardStatusVisible(levels, status)) out[status] = n
  }
  return out
}
