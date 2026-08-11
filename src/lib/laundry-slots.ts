// ============================================================================
// Pickup / Delivery time slots — SINGLE SOURCE OF TRUTH.
//
// One config per business (LaundryOperationalConfig: start/end/duration for
// pickup and for delivery) generates the slot list used EVERYWHERE a slot is
// picked: New Order, Ready for Delivery, and the Storefront website. Change the
// window in Settings once → every surface updates. Slots read "HH:MM - HH:MM".
// ============================================================================

export type SlotConfig = { start: string; end: string; durationMin: number }

export const DEFAULT_PICKUP_SLOT: SlotConfig = { start: "07:00", end: "21:00", durationMin: 120 }
export const DEFAULT_DELIVERY_SLOT: SlotConfig = { start: "14:00", end: "23:00", durationMin: 60 }

// Slot-length choices offered in Settings (minutes).
export const SLOT_DURATION_OPTIONS = [60, 90, 120, 180] as const

const toMin = (hhmm: string): number => {
  const [h, m] = String(hhmm || "").split(":").map((n) => parseInt(n, 10))
  if (!Number.isFinite(h)) return NaN
  return h * 60 + (Number.isFinite(m) ? m : 0)
}
const toHHMM = (min: number): string => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`

// Build the ordered slot list for a config. Guards bad input (empty/reversed).
export function generateSlots(cfg: SlotConfig): string[] {
  const start = toMin(cfg?.start)
  const end = toMin(cfg?.end)
  const dur = Math.max(30, Math.round(cfg?.durationMin || 60))
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return []
  const out: string[] = []
  for (let s = start; s + dur <= end; s += dur) out.push(`${toHHMM(s)} - ${toHHMM(s + dur)}`)
  return out
}

// Is this slot already in the past for the given date? Used to gray out slots
// that can no longer be booked. `dateISO` is a yyyy-mm-dd (or any Date-parsable)
// value; a slot is past when its START time on that date is before `now`.
export function slotIsPast(slot: string, dateISO: string | null | undefined, now: Date = new Date()): boolean {
  if (!slot || !dateISO) return false
  const startStr = String(slot).split("-")[0].trim()
  const start = toMin(startStr)
  if (!Number.isFinite(start)) return false
  const d = new Date(dateISO)
  if (isNaN(d.getTime())) return false
  d.setHours(Math.floor(start / 60), start % 60, 0, 0)
  return d.getTime() < now.getTime()
}

/**
 * Has this slot COMPLETELY ended?
 *
 * The distinction that matters for a pickup: at 16:47 the 16:00-17:00 slot has
 * started but not finished, and is still perfectly bookable — a courier can
 * still come. slotIsPast() answers "has it started", which is the right question
 * for a DELIVERY floor (nothing may be promised before the TAT elapses) and the
 * wrong one for pickup availability.
 *
 * At exactly the end time the slot is treated as over.
 */
export function slotHasEnded(slot: string, dateISO: string | null | undefined, now: Date = new Date()): boolean {
  if (!slot || !dateISO) return false
  const parts = String(slot).split("-")
  const endStr = (parts[1] ?? parts[0]).trim()
  const end = toMin(endStr)
  if (!Number.isFinite(end)) return false
  const d = new Date(dateISO)
  if (isNaN(d.getTime())) return false
  d.setHours(Math.floor(end / 60), end % 60, 0, 0)
  return d.getTime() <= now.getTime()
}

// Normalise a raw op-config row (or partial) into the two SlotConfigs, applying
// defaults for any missing field. Keeps every surface consistent.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function slotConfigsFrom(cfg: any): { pickup: SlotConfig; delivery: SlotConfig } {
  return {
    pickup: {
      start: cfg?.pickupSlotStart || DEFAULT_PICKUP_SLOT.start,
      end: cfg?.pickupSlotEnd || DEFAULT_PICKUP_SLOT.end,
      durationMin: cfg?.pickupSlotDurationMin || DEFAULT_PICKUP_SLOT.durationMin,
    },
    delivery: {
      start: cfg?.deliverySlotStart || DEFAULT_DELIVERY_SLOT.start,
      end: cfg?.deliverySlotEnd || DEFAULT_DELIVERY_SLOT.end,
      durationMin: cfg?.deliverySlotDurationMin || DEFAULT_DELIVERY_SLOT.durationMin,
    },
  }
}
