// Service turnaround time — the ONE effective-TAT calculation.
//
// This is not a delivery engine and must never become one. It answers a single
// question — "how many hours before this order can be delivered?" — and hands
// the answer to the existing delivery-date, slot and capacity logic, which
// remain the source of truth for what the customer can actually pick.
//
//   service TAT  →  [ existing slots + capacity + closures ]  →  delivery date
//
// STANDARD SERVICES ARE UNTOUCHED. A service with tatEnabled = false
// contributes STANDARD_TAT_HOURS, which is the 24h the storefront already
// implied with its "pickup date + 1 day" minimum. Nothing about those orders
// changes.

/** What a service without its own turnaround contributes. Matches the existing
 *  storefront behaviour (delivery no earlier than the day after pickup). */
export const STANDARD_TAT_HOURS = 24

export type TatUnit = "HOURS" | "DAYS"

export interface TatService {
  /** Per-service turnaround in HOURS — the existing column. */
  defaultTurnaroundHours?: number | null
  /** Off means "use the standard delivery time", not "0 hours". */
  tatEnabled?: boolean | null
  /** Display unit only; the value above is always hours. */
  tatUnit?: string | null
}

const isPositive = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n > 0

/**
 * Hours this service needs. A service that has not opted in returns the
 * standard, so a caller never has to special-case it.
 */
export function effectiveTatHours(service: TatService | null | undefined, standardHours = STANDARD_TAT_HOURS): number {
  if (!service?.tatEnabled) return standardHours
  return isPositive(service.defaultTurnaroundHours) ? service.defaultTurnaroundHours : standardHours
}

/** True only when the service genuinely overrides the standard. */
export function hasCustomTat(service: TatService | null | undefined, standardHours = STANDARD_TAT_HOURS): boolean {
  return !!service?.tatEnabled && isPositive(service.defaultTurnaroundHours) && service.defaultTurnaroundHours !== standardHours
}

/**
 * The order's turnaround: the LONGEST of its services.
 *
 * A cart holding a 24h wash and a 6h express is a 24h order — the express item
 * cannot be delivered separately, so promising 6h would be promising something
 * the workflow cannot do. An empty cart is simply the standard.
 */
export function orderTatHours(services: (TatService | null | undefined)[], standardHours = STANDARD_TAT_HOURS): number {
  if (!services.length) return standardHours
  return services.reduce<number>((max, s) => Math.max(max, effectiveTatHours(s, standardHours)), 0) || standardHours
}

/** The moment an order becomes deliverable. */
export function earliestDeliveryAt(from: Date, tatHours: number): Date {
  return new Date(from.getTime() + tatHours * 60 * 60 * 1000)
}

/** Local YYYY-MM-DD, for a date input's `min`. Local, not UTC: a 9pm order in
 *  Kolkata must not report the previous day. */
export function dayKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/**
 * Earliest selectable delivery DATE for a cart.
 *
 * `from` is when the clock starts: the scheduled pickup for a pickup order,
 * because garments cannot be washed before they are collected — and "now" when
 * there is no pickup. This preserves the existing storefront meaning, where the
 * delivery minimum was already measured from the pickup date.
 */
export function earliestDeliveryDayKey(from: Date, services: (TatService | null | undefined)[], standardHours = STANDARD_TAT_HOURS): string {
  return dayKey(earliestDeliveryAt(from, orderTatHours(services, standardHours)))
}

/** "12-hour delivery" / "2-day delivery" — customer-facing, never jargon. */
export function tatLabel(hours: number, unit?: string | null): string {
  if (unit === "DAYS" || (!unit && hours % 24 === 0 && hours >= 24)) {
    const d = Math.round(hours / 24)
    return `${d}-day delivery`
  }
  return `${hours}-hour delivery`
}

/** Convert what the owner typed into the hours actually stored. */
export function toHours(value: number, unit: TatUnit): number {
  const v = Math.max(1, Math.round(Number(value) || 0))
  return unit === "DAYS" ? v * 24 : v
}

/** Split stored hours back into the owner's chosen unit for editing. */
export function fromHours(hours: number, unit?: string | null): { value: number; unit: TatUnit } {
  if (unit === "DAYS") return { value: Math.max(1, Math.round(hours / 24)), unit: "DAYS" }
  return { value: Math.max(1, Math.round(hours)), unit: "HOURS" }
}

// ── Standard and Express cannot share an order ──────────────────────────────
// One order carries ONE delivery promise. A cart holding a 24h standard service
// and a 6h express service has no honest answer: taking the longest silently
// removes what the customer paid express for, and taking the shortest promises
// something the workflow cannot do. Rather than guess, or split the cart behind
// the customer's back, checkout refuses and asks for two orders.
//
// This does not touch the 1 service = 1 bag rule, and it does not restrict
// several standard services together or several express services together —
// those still resolve through orderTatHours() exactly as before.

export const MIXED_DELIVERY_MESSAGE =
  "Standard and Express services cannot be placed in the same order. Please submit Express services separately."

/** A service is Express when it has been given its own turnaround. */
export function isExpressService(s: TatService | null | undefined): boolean {
  return !!s?.tatEnabled
}

/** True when the cart holds at least one of each — the only refused case. */
export function hasMixedDeliveryTypes(services: (TatService | null | undefined)[]): boolean {
  let express = false
  let standard = false
  for (const s of services) {
    if (isExpressService(s)) express = true
    else standard = true
    if (express && standard) return true
  }
  return false
}
