// ============================================================================
// STOREFRONT SLOT PICKER — which list does each dropdown read, and what does it
// say when that list is empty?
//
// The public slots endpoint answers PER DATE: a date inside a declared closure
// offers nothing, and on store hours the window is clipped to that day. The
// storefront checkout asked it once WITHOUT a date, kept the single answer for
// the whole session, and pointed both the Standard and the Backup delivery
// dropdown at it. So:
//
//   • "No delivery slots available for this date" was said about a list that
//     had never been computed for any date. It is the answer to "did the one
//     request at mount succeed", dressed up as an answer about the date.
//   • That one request had no loading state, no retry and a swallowed error,
//     so a single failed response left both delivery dropdowns permanently
//     empty while the pickup dropdown recovered on the next date change.
//
// This module is the rule, kept pure so it can be tested without a browser:
// every date the customer picks gets its OWN entry, and a dropdown renders one
// of THREE distinct states — still loading, failed to load, or genuinely empty.
// Being unable to answer is not the same as answering "none", and neither one
// means the business is closed.
// ============================================================================

/** The date-less baseline: the tenant's configured window, before any date. */
export const BASE_SLOT_KEY = ""

export type SlotKind = "pickup" | "delivery"

export type SlotDayStatus = "loading" | "ready" | "error"

export interface SlotDay {
  status: SlotDayStatus
  pickup: string[]
  delivery: string[]
}

export type SlotDayMap = Record<string, SlotDay>

export interface SlotListing {
  status: SlotDayStatus
  slots: string[]
}

/**
 * Which keys need a request, given the dates in play and what is already held.
 *
 * The baseline is always wanted — it is what the dropdowns show before a date
 * exists, and what Confirm needs a default from. Blank and duplicate dates are
 * dropped, so three fields on the same day cost one request, not three.
 * Anything already loading, ready or errored is left alone; a retry clears the
 * entry first rather than being expressed here.
 */
export function slotDatesToFetch(
  dates: (string | null | undefined)[],
  have: SlotDayMap,
): string[] {
  const wanted = [BASE_SLOT_KEY, ...dates.map((d) => (d ? String(d) : ""))]
  const out: string[] = []
  for (const key of wanted) {
    if (Object.prototype.hasOwnProperty.call(have, key)) continue
    if (out.includes(key)) continue
    out.push(key)
  }
  return out
}

/**
 * The list a dropdown for `dateISO` must render.
 *
 * A date with no entry yet is LOADING, never empty — the request for it is
 * either in flight or about to be made, and calling that "no slots" is the
 * defect this module exists to prevent. With no date chosen the dropdown falls
 * back to the baseline window, which is what the customer is choosing from
 * before they have named a day.
 */
export function slotListFor(map: SlotDayMap, dateISO: string | null | undefined, kind: SlotKind): SlotListing {
  // Deliberately NOT falling back to the baseline for a date that has not
  // answered yet: the baseline is the unclipped configured window, so standing
  // it in would offer times the date itself may not have.
  const entry = map[dateISO ? String(dateISO) : BASE_SLOT_KEY]
  if (!entry) return { status: "loading", slots: [] }
  return { status: entry.status, slots: entry.status === "ready" ? entry[kind] : [] }
}

/**
 * The text of the placeholder option — the one line the customer actually
 * reads. Each status says what is true, and only the last one is about the
 * date. `noun` is "pickup" or "delivery" so the message names the leg.
 */
export function slotPlaceholder(listing: SlotListing, noun: string): string {
  if (listing.status === "loading") return "Loading…"
  if (listing.status === "error") return `Couldn't load ${noun} slots — tap Retry`
  if (listing.slots.length === 0) return `No ${noun} slots available for this date`
  return "Select slot"
}

/**
 * Keep a selection honest against the list actually offered for its date.
 *
 * A dropdown value survives a date change on its own, so a slot the new date
 * does not offer — or one that is FULL or too early for the turnaround — stays
 * selected and gets submitted. The first bookable slot replaces it; when the
 * date offers none, the selection is cleared so Confirm asks for one rather
 * than sending a slot the server will refuse.
 *
 * While the date is still loading or has failed, the current value is kept:
 * clearing it there would lose a valid choice to a network hiccup.
 */
export function reconcileSlotSelection(
  current: string,
  listing: SlotListing,
  isBlocked: (slot: string) => boolean = () => false,
): string {
  if (listing.status !== "ready") return current
  const bookable = listing.slots.filter((s) => !isBlocked(s))
  if (current && listing.slots.includes(current) && !isBlocked(current)) return current
  return bookable[0] ?? ""
}
