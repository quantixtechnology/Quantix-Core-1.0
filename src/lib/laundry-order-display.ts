// ============================================================================
// ORDER SERVICE + WEIGHT — one way to render the two facts the operational
// screens (Sorting, Orders, Store Audit, Payments & Ledger) all need to show.
//
// WEIGHT is `LaundryOrder.totalWeightKg`: the single total order weight in kg,
// measured at Store Audit, which drives PER_KG billing. It is the ONLY recorded
// order weight. It is deliberately never computed here from garment count, from
// item weights, or from anything else — a screen shows what was weighed, or it
// shows that nothing was weighed.
//
// The column is `Float @default(0)`, not nullable, so "not weighed yet" reaches
// the client as 0 rather than null. Both mean the same thing and both render as
// an em dash: an order that has not reached Store Audit has no weight, and a
// purely per-piece order never gets one at all. Rendering 0 as "0 kg" would
// state a measurement that was never taken.
//
// SERVICE is the order's booked services (LaundryOrderService.serviceName),
// rendered through the existing bookedServiceNames helper so this module does
// not become a second naming system. Under the server's ONE SERVICE = ONE ORDER
// rule that is normally exactly one name; the join is kept for legacy rows that
// carry more.
// ============================================================================

import { bookedServiceNames } from "@/lib/laundry-schedule-display"

/** What every screen shows when a value was never recorded. */
export const NOT_RECORDED = "—"

/**
 * Render a recorded order weight.
 *
 * Returns the em dash for every "no measurement" case — null, undefined, NaN,
 * a non-finite value, 0 (the column default) and any negative — and otherwise
 * "<n> kg", rounded to 2dp with trailing zeros trimmed so 8.5 reads "8.5 kg"
 * and 8.00 reads "8 kg". Same 2dp rounding the processing API applies.
 */
export function orderWeightLabel(totalWeightKg: number | null | undefined): string {
  if (totalWeightKg == null) return NOT_RECORDED
  const n = Number(totalWeightKg)
  if (!Number.isFinite(n) || n <= 0) return NOT_RECORDED
  const rounded = Math.round(n * 100) / 100
  if (rounded <= 0) return NOT_RECORDED
  return `${String(rounded)} kg`
}

/**
 * Render an order's service.
 *
 * Takes the booked LaundryOrderService rows. `fallback` accepts rows that carry
 * a service name from somewhere else — the Sorting queue is item-grained and
 * has each garment's own `serviceName` rather than the order's booked rows —
 * and is used ONLY when there are no booked names. Both go through the same
 * de-duplicating helper, so one service reads as one name on every screen.
 */
export function orderServiceLabel(
  services: { serviceId?: string | null; serviceName?: string | null }[] | null | undefined,
  fallback?: { serviceId?: string | null; serviceName?: string | null }[] | null,
): string {
  const booked = bookedServiceNames(services)
  if (booked.length) return booked.join(", ")
  const alt = bookedServiceNames(fallback)
  return alt.length ? alt.join(", ") : NOT_RECORDED
}
