// ============================================================================
// LAUNDRY STORE AVAILABILITY + WORKING HOURS — single source of truth.
//
// This module REUSES the Commerce platform's availability machinery — it does
// NOT duplicate it. Store status / weekly hours / temporary closure live on the
// platform `Store` + `StoreTiming` records that the storefront website already
// resolves (via /api/core/storefront/store-context). Laundry simply points at
// the same store and derives:
//
//   • isOpen now                  → checkStoreOpen()          (Commerce lib)
//   • per-day working hours       → StoreTiming rows          (Commerce model)
//   • date availability           → timingForDate()           (Commerce lib)
//   • slot filtering by hours     → slotsWithinWorkingHours() (Commerce lib)
//   • Temporarily Closed reason + re-open time → Store.closedReason / closedUntil
//
// The Laundry workspace settings writes through this same store (see
// /api/laundry/availability), so one configuration drives the storefront
// website, the customer PWA, the customer app API and server-side order guards.
// ============================================================================
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import {
  checkStoreOpen,
  timingForDate,
  slotsWithinWorkingHours,
  formatTimeLabel,
  formatReopenAt,
  resolveStatusOverride,
  DAY_NAMES_SHORT,
} from "@/lib/core/store"
import type { StoreDayTiming, StoreOpenResult } from "@/lib/core/store"
import { PRINT_TIMEZONE as BUSINESS_TIMEZONE } from "@/lib/print-timestamp"
import { readCustomerOrderingMode, bypassesStoreHours } from "@/lib/customer-ordering"

export interface LaundryAvailability {
  storeId: string | null
  isOnline: boolean
  isOpen: boolean
  reason: string | null
  opensAt: string | null
  closedReason: string | null
  closedUntil: string | null // ISO
  timings: StoreDayTiming[]
  businessHours: string | null      // today: "9:00 AM – 9:00 PM"
  todayDay: number
  dayName: string
  status: "open" | "closed" | "offline"
}

export interface DateAvailability {
  available: boolean
  reason: string | null
  openTime: string | null
  closeTime: string | null
}

// Resolve the platform Store that hosts the availability/hours for a laundry
// business. Prefers the explicitly-chosen store (from the storefront), else the
// main active store, else any active store — same resolution as store-context.
export async function resolvePlatformStore(
  input: string | null | undefined,
  storeId?: string | null,
): Promise<{ storeId: string | null; platformBusinessId: string | null }> {
  const biz = await resolveLaundryBusiness(input)
  if (!biz?.platformBusinessId) return { storeId: null, platformBusinessId: null }
  const platformId = biz.platformBusinessId

  let store: { id: string } | null = null
  if (storeId) {
    store = await prisma.store.findFirst({ where: { id: storeId, businessId: platformId, status: "ACTIVE" }, select: { id: true } })
  }
  if (!store) {
    store = await prisma.store.findFirst({ where: { businessId: platformId, status: "ACTIVE", isMainStore: true }, select: { id: true } })
  }
  if (!store) {
    store = await prisma.store.findFirst({ where: { businessId: platformId, status: "ACTIVE" }, select: { id: true } })
  }
  return { storeId: store?.id ?? null, platformBusinessId: platformId }
}

export async function getLaundryAvailability(
  input: string | null | undefined,
  storeId?: string | null,
): Promise<LaundryAvailability> {
  const { storeId: sid, platformBusinessId } = await resolvePlatformStore(input, storeId)

  const empty: LaundryAvailability = {
    storeId: null, isOnline: false, isOpen: false, reason: "Store unavailable", opensAt: null,
    closedReason: null, closedUntil: null, timings: [], businessHours: null, todayDay: -1, dayName: "", status: "offline",
  }
  if (!sid || !platformBusinessId) return empty

  const [store, biz, openResult] = await Promise.all([
    prisma.store.findUnique({
      where: { id: sid },
      select: { closedReason: true, closedUntil: true, storeTimings: { orderBy: { day: "asc" } } },
    }),
    prisma.business.findUnique({ where: { id: platformBusinessId }, select: { isOnline: true, settings: true } }),
    // The mode is read first so the "open right now" answer this returns is the
    // SAME one the booking guard will give — a customer app that shows an open
    // shop and a server that then refuses the order is the worst of both.
    prisma.business.findUnique({ where: { id: platformBusinessId }, select: { settings: true } })
      .then((b) => checkStoreOpen(sid, { ignoreWorkingHours: bypassesStoreHours(readCustomerOrderingMode(b?.settings)) })),
  ])
  if (!store) return empty

  const timings: StoreDayTiming[] = store.storeTimings
  const now = new Date()
  const todayDay = now.getUTCDay() // guarded below via IST
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000)
  const istDay = ist.getUTCDay()
  const todayRow = timings.find((t) => t.day === istDay)
  const businessHours = todayRow && !todayRow.isClosed
    ? `${formatTimeLabel(todayRow.openTime)} – ${formatTimeLabel(todayRow.closeTime)}`
    : null

  const isOnline = biz?.isOnline ?? false
  const result = openResult as StoreOpenResult
  const temporarilyClosed = !!store.closedReason || !!store.closedUntil

  return {
    storeId: sid,
    isOnline,
    isOpen: result.isOpen,
    reason: result.isOpen ? null : (result.reason || null),
    opensAt: result.opensAt || (store.closedUntil ? formatReopenAt(store.closedUntil) : null) || null,
    closedReason: store.closedReason || null,
    closedUntil: store.closedUntil ? store.closedUntil.toISOString() : null,
    timings,
    businessHours,
    todayDay: istDay,
    dayName: istDay >= 0 ? DAY_NAMES_SHORT[istDay] : "",
    status: !isOnline ? "offline" : result.isOpen ? "open" : temporarilyClosed ? "closed" : "closed",
  }
}

// ============================================================================
// PER-BRANCH SCHEDULE + OVERRIDE (LaundryStore)
// Each LaundryStore branch carries its own optional weekly schedule
// (`businessHoursOverride` JSON) and an open/closed override
// (`statusOverride`). These drive the storefront once an order is assigned to
// a branch, while the business's standard schedule remains the global default.
// A 7-day override shape: { day, openTime, closeTime, isClosed }[].
// ============================================================================

export interface BranchOverride {
  type: "override" | "automatic"
  isForceClosed?: boolean
  isForceOpen?: boolean
}

/** Parse a LaundryStore.businessHoursOverride JSON string into timing rows. */
export function parseBranchHoursOverride(raw: string | null | undefined): StoreDayTiming[] {
  try {
    const parsed = JSON.parse(raw || "{}")
    if (Array.isArray(parsed)) {
      return parsed
        .filter((t: { day?: number }) => typeof t.day === "number")
        .map((t: { day: number; openTime?: string; closeTime?: string; isClosed?: boolean }) => ({
          day: t.day,
          openTime: t.openTime || "09:00",
          closeTime: t.closeTime || "21:00",
          isClosed: !!t.isClosed,
        }))
    }
    if (parsed && Array.isArray(parsed.timings)) {
      return parsed.timings
    }
    return []
  } catch {
    return []
  }
}

/** Serialize timings back to the LaundryStore.businessHoursOverride JSON shape. */
export function serializeBranchHoursOverride(timings: StoreDayTiming[]): string {
  return JSON.stringify(timings.map((t) => ({ day: t.day, openTime: t.openTime, closeTime: t.closeTime, isClosed: t.isClosed })))
}

/** Resolve the effective schedule for a branch: override rows if set, else the platform store's timings. */
export async function resolveBranchSchedule(
  laundryStoreId: string,
  timings: StoreDayTiming[],
): Promise<StoreDayTiming[]> {
  if (!laundryStoreId) return timings
  const ls = await prisma.laundryStore.findUnique({
    where: { id: laundryStoreId },
    select: { businessHoursOverride: true },
  })
  if (!ls) return timings
  const override = parseBranchHoursOverride(ls.businessHoursOverride)
  return override.length > 0 ? override : timings
}

/** Whether a branch is currently accepting orders, honoring its own override first. */
export async function checkBranchOpen(
  laundryStoreId: string,
  fallback: StoreOpenResult,
): Promise<StoreOpenResult> {
  if (!laundryStoreId) return fallback
  const ls = await prisma.laundryStore.findUnique({
    where: { id: laundryStoreId },
    select: { statusOverride: true, overrideExpiresAt: true, businessHoursOverride: true },
  })
  if (!ls) return fallback
  // Single engine — use the same expiry-aware override resolver as platform stores.
  const overrideApplied = resolveStatusOverride(ls.statusOverride, ls.overrideExpiresAt)
  if (overrideApplied === "FORCE_OPEN") return { isOpen: true }
  if (overrideApplied === "FORCE_CLOSED") return { isOpen: false, reason: "Store is temporarily closed by the operator" }
  if (fallback.isOpen) return fallback

  const branchHours = parseBranchHoursOverride(ls.businessHoursOverride)
  if (branchHours.length === 0) return fallback

  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
  const day = ist.getUTCDay()
  const nowMin = ist.getUTCHours() * 60 + ist.getUTCMinutes()
  const row = branchHours.find((t) => t.day === day)
  if (!row || row.isClosed) return { isOpen: false, reason: "Store is closed today" }
  const openMin = Number(row.openTime.slice(0, 2)) * 60 + Number(row.openTime.slice(3, 5))
  const closeMin = Number(row.closeTime.slice(0, 2)) * 60 + Number(row.closeTime.slice(3, 5))
  if (nowMin < openMin) return { isOpen: false, reason: `Store is not open yet. Opens at ${row.openTime}`, opensAt: row.openTime }
  if (nowMin >= closeMin) return { isOpen: false, reason: "Store is closed" }
  return { isOpen: true }
}

// Is a specific pickup/delivery date bookable? Respects weekly off-days
/** Today's date in the business timezone, as YYYY-MM-DD. */
export function businessToday(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD, which sorts correctly as a string.
  return now.toLocaleDateString("en-CA", { timeZone: BUSINESS_TIMEZONE })
}

// (StoreTiming) holidays/temporary closures (closedUntil) — never a past date.
// When `ignoreWorkingHours` is true (24/7 Customer Ordering), the StoreTiming
// weekly schedule and holidays do NOT close ordering — only truly past dates
// and empty/invalid inputs are rejected.  The caller still gets back the
// operational slot list so the customer can pick a valid pickup/delivery slot.
export function isLaundryDateAvailable(
  timings: StoreDayTiming[],
  dateISO: string | null | undefined,
  closedUntil?: string | Date | null,
  opts?: { ignoreWorkingHours?: boolean },
): DateAvailability {
  if (!dateISO) return { available: false, reason: "Select a date", openTime: null, closeTime: null }
  const start = new Date(`${dateISO}T00:00:00.000Z`)
  if (isNaN(start.getTime())) return { available: false, reason: "Invalid date", openTime: null, closeTime: null }

  // A date is past only when its CALENDAR DAY is before today's, in business
  // local time. This used to compare UTC midnight against now minus six hours —
  // a rough stand-in for IST that broke every day at about 11:30 AM local, when
  // "today" started reporting itself as past. A day is not in the past because
  // some of it has elapsed; whether a particular SLOT has ended is a separate
  // question, answered by slotHasEnded() against the chosen slot.
  if (dateISO < businessToday()) {
    return { available: false, reason: "This date is in the past", openTime: null, closeTime: null }
  }

  const res = timingForDate(timings, dateISO, closedUntil)
  if (!res.available) {
    if (opts?.ignoreWorkingHours && res.reason !== 'Closed for a holiday') {
      // 24/7 ordering: the weekly schedule does not gate date selection.
      // Temporary closures (holiday / closedUntil) still apply — those are
      // deliberate, not about the hour of the day.
      return { available: true, reason: null, openTime: res.openTime || null, closeTime: res.closeTime || null }
    }
    return { available: false, reason: res.reason || "Unavailable", openTime: null, closeTime: null }
  }
  return { available: true, reason: null, openTime: res.openTime || null, closeTime: res.closeTime || null }
}

// Restrict a generated slot list to the working hours of a given date.
// When `ignoreWorkingHours` is true (24/7 ordering), the full operational slot
// list is returned regardless of the day's StoreTiming — the customer can pick
// any slot and the order will be fulfilled during the shop's next working window.
export function laundrySlotsForDate(
  slots: string[],
  timings: StoreDayTiming[],
  dateISO: string | null | undefined,
  closedUntil?: string | Date | null,
  opts?: { ignoreWorkingHours?: boolean },
): string[] {
  if (!dateISO) return slots
  if (opts?.ignoreWorkingHours) return slots
  const row = timingForDate(timings, dateISO, closedUntil)
  if (!row.available) return []
  return slotsWithinWorkingHours(slots, row.openTime, row.closeTime)
}

// Server-side guard used by customer order-creation paths (storefront checkout
// + customer app). Rejects when the store is closed/offline right now.
export interface BookingOpenResult {
  ok: boolean
  error?: string
  opensAt?: string | null
  reason?: string | null
}

export async function assertLaundryStoreOpen(
  input: string | null | undefined,
  storeId?: string | null,
  opts: { ignoreWorkingHours?: boolean } = {},
): Promise<BookingOpenResult> {
  const { storeId: sid } = await resolvePlatformStore(input, storeId)
  if (!sid) return { ok: false, error: "Store is currently unavailable", opensAt: null }
  const r = await checkStoreOpen(sid, opts)
  if (!r.isOpen) return { ok: false, error: r.reason || "Store is currently closed", opensAt: r.opensAt ?? null, reason: r.reason || null }
  return { ok: true }
}

// Server-side guard for a specific booking date (+ slot window).
export function assertLaundryDateAvailable(
  timings: StoreDayTiming[],
  dateISO: string | null | undefined,
  label: string,
  closedUntil?: string | Date | null,
  opts?: { ignoreWorkingHours?: boolean },
): { ok: true } | { ok: false; error: string } {
  const a = isLaundryDateAvailable(timings, dateISO, closedUntil, opts)
  if (!a.available) return { ok: false, error: `${label} is unavailable${a.reason ? ` (${a.reason})` : ""}. Please choose another date.` }
  return { ok: true }
}

// One-shot guard for customer order-creation paths (storefront checkout +
// customer app). Rejects when the store is closed right now AND when any
// requested date/slot falls outside that day's working hours.
export interface BookingGuardOptions {
  storeId?: string | null
  pickupDate?: string | null
  pickupSlot?: string | null
  deliveryDate?: string | null
  deliverySlot?: string | null
  backupDate?: string | null
  backupSlot?: string | null
}

/**
 * The tenant's Customer Ordering Availability.
 *
 * Resolved from the PLATFORM business row, because the setting belongs to the
 * business rather than to one of its stores — a tenant does not take orders
 * round the clock at one branch and not another.
 */
export async function resolveCustomerOrderingMode(
  input: string | null | undefined,
): Promise<ReturnType<typeof readCustomerOrderingMode>> {
  if (!input) return readCustomerOrderingMode(null)
  const biz = await resolveLaundryBusiness(input).catch(() => null)
  if (!biz?.platformBusinessId) return readCustomerOrderingMode(null)
  const row = await prisma.business.findUnique({
    where: { id: biz.platformBusinessId },
    select: { settings: true },
  }).catch(() => null)
  return readCustomerOrderingMode(row?.settings)
}

export async function assertLaundryBookingOpen(
  input: string | null | undefined,
  opts: BookingGuardOptions = {},
): Promise<{ ok: true; storeId: string } | { ok: false; error: string }> {
  // Is the tenant on 24/7 Customer Ordering? Read from the business's own
  // settings — absent means FOLLOW_STORE_HOURS, so every tenant that has never
  // touched this behaves exactly as before.
  const ordering = await resolveCustomerOrderingMode(input)

  // "Open right now" — the ONLY check 24/7 relaxes, and only its hours branch.
  const open = await assertLaundryStoreOpen(input, opts.storeId, {
    ignoreWorkingHours: bypassesStoreHours(ordering),
  })
  if (!open.ok) return { ok: false, error: open.error || "Store is currently closed" }

  // Everything below is untouched by the mode. A midnight order is accepted,
  // and then has to pick a pickup and delivery slot the shop can actually
  // work — which is the existing slot logic, unchanged.

  const { storeId } = await resolvePlatformStore(input, opts.storeId)
  if (!storeId) return { ok: false, error: "Store is currently unavailable" }
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { closedUntil: true, storeTimings: { orderBy: { day: "asc" } } },
  })
  if (!store) return { ok: false, error: "Store is currently unavailable" }

  const checks: { date?: string | null; slot?: string | null; label: string }[] = [
    { date: opts.pickupDate, slot: opts.pickupSlot, label: "Pickup" },
    { date: opts.deliveryDate, slot: opts.deliverySlot, label: "Standard delivery" },
    { date: opts.backupDate, slot: opts.backupSlot, label: "Backup delivery" },
  ]
  const dateOpts = { ignoreWorkingHours: bypassesStoreHours(ordering) }
  for (const c of checks) {
    if (!c.date) continue
    const a = assertLaundryDateAvailable(store.storeTimings, c.date, c.label, store.closedUntil, dateOpts)
    if (!a.ok) return a
    if (c.slot && !bypassesStoreHours(ordering)) {
      const row = timingForDate(store.storeTimings, c.date, store.closedUntil)
      if (slotsWithinWorkingHours([c.slot], row.openTime, row.closeTime).length === 0) {
        return { ok: false, error: `${c.label} time ${c.slot} is outside business hours on ${c.date}. Please choose another slot.` }
      }
    }
  }
  return { ok: true, storeId }
}
