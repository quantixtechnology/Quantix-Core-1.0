// The customer's delivery promise — one definition, read by every screen.
//
// A laundry order carries two different delivery dates and conflating them is
// the whole problem this solves:
//
//   promisedDeliveryDate   what the CUSTOMER was told at booking. Frozen at
//                          confirmation, never rewritten.
//   deliveryDate           what the BUSINESS is currently working to. The
//                          dispatch desk rewrites it on every reschedule.
//
// Before this existed only the second survived, so by the time an order reached
// Ready for Delivery nobody could see what had actually been promised — and a
// missed promise was invisible until the customer rang.
//
// Everything here is pure and client-safe: the same function decides the badge
// on a workstation card, the status on the order page and the filter on a
// report, so those three can never disagree.

export type PromiseStatus =
  | "NOT_CAPTURED"
  | "ON_SCHEDULE"
  | "DUE_TODAY"
  | "PRIMARY_MISSED"
  | "BACKUP_MISSED"
  | "DELIVERED_ON_PRIMARY"
  | "DELIVERED_ON_BACKUP"
  | "DELIVERED_LATE"

/** The frozen promise plus whatever actually happened, as the API returns it. */
export interface DeliveryPromiseInput {
  promisedDeliveryDate?: string | Date | null
  promisedDeliveryTimeSlot?: string | null
  promisedBackupDeliveryDate?: string | Date | null
  promisedBackupDeliveryTimeSlot?: string | null
  /** Current operational schedule — a reschedule when it differs from primary. */
  deliveryDate?: string | Date | null
  deliveryTimeSlot?: string | null
  deliveryRescheduledAt?: string | Date | null
  deliveryRescheduleReason?: string | null
  deliveredAt?: string | Date | null
}

export interface DeliveryPromise {
  status: PromiseStatus
  label: string
  /** Short form for a badge on a dense card. */
  shortLabel: string
  tone: "neutral" | "good" | "warn" | "late" | "critical"
  captured: boolean
  primary: { date: string | null; slot: string | null }
  backup: { date: string | null; slot: string | null }
  /** Set only when the business moved the date away from the promise. */
  rescheduled: { date: string | null; slot: string | null; at: string | null; reason: string | null } | null
  deliveredAt: string | null
  /** Whole days past the primary promise. Negative before it, 0 on the day. */
  daysLate: number | null
  /** True while the order is live and at least the primary promise has passed. */
  breached: boolean
}

/** Local calendar day, so "today" means the operator's today. */
export function dayKey(d: string | Date | null | undefined): string | null {
  if (!d) return null
  const date = typeof d === "string" ? new Date(d) : d
  if (Number.isNaN(date.getTime())) return null
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function daysBetween(fromKey: string, toKey: string): number {
  const a = new Date(`${fromKey}T00:00:00`)
  const b = new Date(`${toKey}T00:00:00`)
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

const TONE: Record<PromiseStatus, DeliveryPromise["tone"]> = {
  NOT_CAPTURED: "neutral",
  ON_SCHEDULE: "good",
  DUE_TODAY: "warn",
  PRIMARY_MISSED: "late",
  BACKUP_MISSED: "critical",
  DELIVERED_ON_PRIMARY: "good",
  DELIVERED_ON_BACKUP: "good",
  DELIVERED_LATE: "critical",
}

const LABEL: Record<PromiseStatus, string> = {
  NOT_CAPTURED: "No delivery promise recorded",
  ON_SCHEDULE: "On Schedule",
  DUE_TODAY: "Due Today",
  PRIMARY_MISSED: "Primary Delivery Promise Missed",
  BACKUP_MISSED: "Primary & Backup Delivery Promise Missed",
  DELIVERED_ON_PRIMARY: "Delivered on Primary Date",
  DELIVERED_ON_BACKUP: "Delivered on Backup Date",
  DELIVERED_LATE: "Delivered after Customer Promise",
}

const SHORT: Record<PromiseStatus, string> = {
  NOT_CAPTURED: "No promise",
  ON_SCHEDULE: "On Schedule",
  DUE_TODAY: "Due Today",
  PRIMARY_MISSED: "Primary Missed",
  BACKUP_MISSED: "Backup Missed",
  DELIVERED_ON_PRIMARY: "On Time",
  DELIVERED_ON_BACKUP: "On Backup",
  DELIVERED_LATE: "Late",
}

/**
 * Resolve an order's promise state.
 *
 * `now` is injectable so a test does not depend on the clock and a server-side
 * filter can evaluate the same rule for a given day.
 */
export function deliveryPromise(o: DeliveryPromiseInput, now: Date = new Date()): DeliveryPromise {
  const primaryKey = dayKey(o.promisedDeliveryDate)
  const backupKey = dayKey(o.promisedBackupDeliveryDate)
  const deliveredKey = dayKey(o.deliveredAt)
  const todayKey = dayKey(now) as string

  const opDate = dayKey(o.deliveryDate)
  // A reschedule is the operational date having moved off the promise. No
  // separate field to drift: if they differ, the business moved it.
  const rescheduled = primaryKey && opDate && opDate !== primaryKey
    ? {
      date: o.deliveryDate ? new Date(o.deliveryDate).toISOString() : null,
      slot: o.deliveryTimeSlot ?? null,
      at: o.deliveryRescheduledAt ? new Date(o.deliveryRescheduledAt).toISOString() : null,
      reason: o.deliveryRescheduleReason ?? null,
    }
    : null

  const base = {
    captured: !!primaryKey,
    primary: {
      date: o.promisedDeliveryDate ? new Date(o.promisedDeliveryDate).toISOString() : null,
      slot: o.promisedDeliveryTimeSlot ?? null,
    },
    backup: {
      date: o.promisedBackupDeliveryDate ? new Date(o.promisedBackupDeliveryDate).toISOString() : null,
      slot: o.promisedBackupDeliveryTimeSlot ?? null,
    },
    rescheduled,
    deliveredAt: o.deliveredAt ? new Date(o.deliveredAt).toISOString() : null,
  }

  const finish = (status: PromiseStatus, daysLate: number | null, breached: boolean): DeliveryPromise => ({
    ...base, status, label: LABEL[status], shortLabel: SHORT[status], tone: TONE[status], daysLate, breached,
  })

  // Legacy orders predate the freeze. Inferring a promise from the operational
  // date would invent one the customer never made, so we say so instead.
  if (!primaryKey) return finish("NOT_CAPTURED", null, false)

  if (deliveredKey) {
    const late = daysBetween(primaryKey, deliveredKey)
    if (late <= 0) return finish("DELIVERED_ON_PRIMARY", late, false)
    if (backupKey && daysBetween(backupKey, deliveredKey) <= 0) return finish("DELIVERED_ON_BACKUP", late, false)
    return finish("DELIVERED_LATE", late, true)
  }

  const vsPrimary = daysBetween(primaryKey, todayKey)
  if (vsPrimary < 0) return finish("ON_SCHEDULE", vsPrimary, false)
  if (vsPrimary === 0) return finish("DUE_TODAY", 0, false)
  // Past the primary. The backup only downgrades further once IT has passed —
  // on the backup day itself the order is still recoverable.
  if (backupKey && daysBetween(backupKey, todayKey) > 0) return finish("BACKUP_MISSED", vsPrimary, true)
  return finish("PRIMARY_MISSED", vsPrimary, true)
}

/** Statuses a filter can select. Keeps the UI and the API using one vocabulary. */
export const PROMISE_FILTERS = [
  { key: "due_today", label: "Due Today", statuses: ["DUE_TODAY"] },
  { key: "on_schedule", label: "On Schedule", statuses: ["ON_SCHEDULE"] },
  { key: "missed_primary", label: "Primary Missed", statuses: ["PRIMARY_MISSED"] },
  { key: "missed_backup", label: "Backup Missed", statuses: ["BACKUP_MISSED"] },
  { key: "late", label: "Late (any breach)", statuses: ["PRIMARY_MISSED", "BACKUP_MISSED", "DELIVERED_LATE"] },
  { key: "delivered_on_time", label: "Delivered On Time", statuses: ["DELIVERED_ON_PRIMARY"] },
  { key: "delivered_on_backup", label: "Delivered on Backup", statuses: ["DELIVERED_ON_BACKUP"] },
  { key: "delivered_late", label: "Delivered After Backup", statuses: ["DELIVERED_LATE"] },
] as const

export type PromiseFilterKey = (typeof PROMISE_FILTERS)[number]["key"]

export function statusesForFilter(key: string): PromiseStatus[] {
  return (PROMISE_FILTERS.find((f) => f.key === key)?.statuses as PromiseStatus[] | undefined) ?? []
}

/** "10 Aug 2026 · 2:00 PM – 4:00 PM" */
export function formatPromiseLine(dateIso: string | null, slot: string | null): string {
  if (!dateIso) return "—"
  const d = new Date(dateIso)
  const date = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
  return slot ? `${date} · ${slot}` : date
}

/**
 * What the customer must be told at confirmation, frozen. Called once, by the
 * order engine — a second call on an existing order would overwrite the very
 * thing this exists to protect.
 */
export function freezePromise(input: { deliveryDate?: Date | null; deliveryTimeSlot?: string | null; backupDeliveryDate?: Date | null; backupDeliveryTimeSlot?: string | null }) {
  if (!input.deliveryDate) return {} // nothing promised — delivery not required
  return {
    promisedDeliveryDate: input.deliveryDate,
    promisedDeliveryTimeSlot: input.deliveryTimeSlot ?? null,
    promisedBackupDeliveryDate: input.backupDeliveryDate ?? null,
    promisedBackupDeliveryTimeSlot: input.backupDeliveryTimeSlot ?? null,
    promiseCapturedAt: new Date(),
  }
}
