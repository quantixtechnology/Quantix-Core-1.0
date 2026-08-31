// ============================================================================
// SCHEDULE CELLS FOR OPERATIONAL QUEUES — display only.
//
// A queue row has to answer "when is this due, and is it late?" at a glance.
// This turns a stored date + time slot into the two lines an operator reads and
// the urgency the row should be tinted with. It is PURELY presentational:
//
//   • it never invents a date — no date in means "—" out;
//   • it never changes a status, and "overdue" is a colour, not a state. An
//     order that is late is still exactly where the workflow put it;
//   • it reuses dayKey() from the delivery-promise engine, so "today" means the
//     same local calendar day everywhere in the app rather than a second,
//     slightly different definition of today.
// ============================================================================
import { dayKey } from "@/lib/laundry-delivery-promise"

export type ScheduleUrgency =
  | "none"      // nothing scheduled
  | "overdue"   // the day has passed
  | "today"     // happening today
  | "upcoming"  // still ahead

export interface ScheduleCell {
  /** "31 Aug 2026", or null when nothing is scheduled. */
  date: string | null
  /** "3:00 PM - 4:00 PM", or null when only a date was booked. */
  slot: string | null
  urgency: ScheduleUrgency
  /** Whole days from today. Negative = past. Null when nothing is scheduled. */
  daysAway: number | null
}

const EMPTY: ScheduleCell = { date: null, slot: null, urgency: "none", daysAway: null }

const daysBetween = (fromKey: string, toKey: string) =>
  Math.round((new Date(`${toKey}T00:00:00`).getTime() - new Date(`${fromKey}T00:00:00`).getTime()) / 86400000)

/**
 * The date + slot an operator reads, and how urgent the row is.
 *
 * `slot` is passed straight through — it is the operator-facing text the Time
 * Slot config already produces, and re-deriving it here would let the queue and
 * the booking screen disagree about the same slot.
 */
export function scheduleCell(
  dateIso: string | Date | null | undefined,
  slot: string | null | undefined,
  now: Date = new Date(),
): ScheduleCell {
  const key = dayKey(dateIso)
  if (!key) return EMPTY
  const todayKey = dayKey(now)
  const d = typeof dateIso === "string" ? new Date(dateIso) : (dateIso as Date)
  const date = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
  const daysAway = todayKey ? daysBetween(todayKey, key) : null
  const urgency: ScheduleUrgency =
    daysAway === null ? "upcoming" : daysAway < 0 ? "overdue" : daysAway === 0 ? "today" : "upcoming"
  return { date, slot: (slot && String(slot).trim()) || null, urgency, daysAway }
}

/** Tailwind classes per urgency — one place, so every queue tints alike. */
export const URGENCY_STYLE: Record<ScheduleUrgency, string> = {
  none: "text-slate-400",
  overdue: "text-rose-700 font-semibold",
  today: "text-amber-700 font-semibold",
  upcoming: "text-slate-700",
}

/** The short word beside an at-risk date. Empty for anything not urgent. */
export function urgencyNote(cell: ScheduleCell): string {
  if (cell.urgency === "today") return "Today"
  if (cell.urgency === "overdue") {
    const late = Math.abs(cell.daysAway ?? 0)
    return late === 1 ? "1 day overdue" : `${late} days overdue`
  }
  return ""
}

/**
 * The booked services on an order, de-duplicated, in order.
 *
 * Display only — it reads the order's OWN LaundryOrderService rows and never
 * decides, derives or narrows a service. An order carrying more than one shows
 * all of them; picking one arbitrarily is what this exists to avoid.
 */
export function bookedServiceNames(
  services: { serviceId?: string | null; serviceName?: string | null }[] | null | undefined,
): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const s of services || []) {
    const name = String(s?.serviceName || "").trim()
    if (!name) continue
    const key = name.toUpperCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(name)
  }
  return out
}
