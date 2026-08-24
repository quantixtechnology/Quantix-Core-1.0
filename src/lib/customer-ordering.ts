// ============================================================================
// Customer Ordering Availability — an optional, per-tenant 24/7 mode.
//
// Store Working Hours answer a question about the SHOP: when is someone there.
// Whether a customer may place an order is a different question, and for some
// businesses the answer is "whenever they like" — the order simply waits for
// the next working slot. Conflating the two means a laundry that is happy to
// take a booking at midnight cannot, because nobody is at the counter.
//
// So this is one setting, and it moves one thing:
//
//   FOLLOW_STORE_HOURS  the shop's hours decide, exactly as they always have
//   ALWAYS_OPEN         the hours no longer close ORDERING
//
// It does NOT touch, and must never be made to touch:
//   • the tenant's configured working hours, which stay as they are
//   • pickup and delivery slots, which keep following the operating schedule —
//     a midnight order takes the next valid slot, it does not invent one
//   • processing or staff hours
//   • the deliberate closures: offline, "temporarily closed", and the operator's
//     force-closed switch all still close the shop. Those are someone saying
//     "not now" on purpose, which is not the same as the clock rolling past six.
//
// Absent means FOLLOW_STORE_HOURS. Every tenant that has never heard of this
// setting therefore behaves exactly as it does today, which is the point: this
// is opt-in, and nothing about it changes a default.
// ============================================================================

export type CustomerOrderingMode = "FOLLOW_STORE_HOURS" | "ALWAYS_OPEN"

export const DEFAULT_CUSTOMER_ORDERING_MODE: CustomerOrderingMode = "FOLLOW_STORE_HOURS"

/** Where it lives inside Business.settings — one key, nothing else disturbed. */
export const CUSTOMER_ORDERING_KEY = "customerOrderingAvailability"

export const isCustomerOrderingMode = (v: unknown): v is CustomerOrderingMode =>
  v === "FOLLOW_STORE_HOURS" || v === "ALWAYS_OPEN"

/**
 * Read the mode out of a Business.settings JSON blob.
 *
 * Null, absent, malformed or unrecognised all mean FOLLOW_STORE_HOURS. An
 * existing tenant has no such key, so it gets today's behaviour without anyone
 * writing anything to its row — and a settings blob we cannot parse must not
 * silently throw a shop open.
 */
export function readCustomerOrderingMode(settings: string | null | undefined): CustomerOrderingMode {
  if (!settings) return DEFAULT_CUSTOMER_ORDERING_MODE
  try {
    const parsed = JSON.parse(settings) as Record<string, unknown>
    const value = parsed?.[CUSTOMER_ORDERING_KEY]
    return isCustomerOrderingMode(value) ? value : DEFAULT_CUSTOMER_ORDERING_MODE
  } catch {
    return DEFAULT_CUSTOMER_ORDERING_MODE
  }
}

/**
 * Merge the mode into a settings blob, preserving everything already in it.
 *
 * Business.settings also carries resourceOverrides and whatever else has been
 * put there; writing this setting must not be a way to lose them.
 */
export function writeCustomerOrderingMode(
  settings: string | null | undefined,
  mode: CustomerOrderingMode,
): string {
  let base: Record<string, unknown> = {}
  if (settings) {
    try {
      const parsed = JSON.parse(settings)
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) base = parsed as Record<string, unknown>
    } catch {
      // Unparseable settings are replaced rather than extended — there is
      // nothing in them to preserve.
    }
  }
  return JSON.stringify({ ...base, [CUSTOMER_ORDERING_KEY]: mode })
}

/**
 * Whether the working-hours check should stop closing ORDERING.
 *
 * Deliberately narrow, and named for what it does rather than for the mode, so
 * that a future caller reaching for it has to mean this and not "is the shop
 * open".
 */
export const bypassesStoreHours = (mode: CustomerOrderingMode): boolean => mode === "ALWAYS_OPEN"
