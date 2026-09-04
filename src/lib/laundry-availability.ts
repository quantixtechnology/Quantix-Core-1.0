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
  closureCoversDate,
  DAY_NAMES_SHORT,
} from "@/lib/core/store"
import type { StoreDayTiming, StoreOpenResult } from "@/lib/core/store"
import { PRINT_TIMEZONE as BUSINESS_TIMEZONE } from "@/lib/print-timestamp"
import { readCustomerOrderingMode, bypassesStoreHours, readBusinessClosure } from "@/lib/customer-ordering"

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

/**
 * Availability for a business that has no platform Store row.
 *
 * Store status, the weekly StoreTiming schedule and the "Temporarily Closed"
 * window (closedReason / closedUntil) all live ON that row. When the row does
 * not exist none of them has been set: there is no schedule to be outside of,
 * and no closure to be under — the owner cannot even declare one, because the
 * settings endpoint refuses without a store. What does exist at business level
 * is the online flag, and that still closes the shop.
 *
 * So the answer here is the SAME one checkStoreOpen() already gives for a store
 * that exists and has no StoreTiming rows: open unless the business is offline.
 * That is why this adds no availability concept — it reuses the hierarchy's
 * existing bottom rung for a business whose store row simply is not there.
 *
 * It is reached only once the BUSINESS itself has resolved. A business that
 * cannot be identified stays unavailable, because that is a question about
 * identity rather than about opening hours.
 */
async function businessLevelAvailability(
  platformBusinessId: string,
): Promise<{ isOnline: boolean; result: StoreOpenResult; closedReason: string | null; closedUntil: Date | null }> {
  const biz = await prisma.business.findUnique({
    where: { id: platformBusinessId },
    select: { isOnline: true, settings: true },
  }).catch(() => null)
  const isOnline = biz?.isOnline ?? false
  // The owner's wording for the closure they declared, when they declared one.
  // isOnline is still the whole of the decision — this is the text that goes
  // with it, so the customer reads "Closed for Diwali" rather than a generic
  // line the owner never wrote.
  const { closedReason, closedUntil } = readBusinessClosure(biz?.settings)
  if (isOnline) return { isOnline, result: { isOpen: true }, closedReason: null, closedUntil: null }
  return {
    isOnline,
    result: {
      isOpen: false,
      reason: closedReason || "Store is currently offline",
      opensAt: closedUntil ? formatReopenAt(closedUntil) : undefined,
    },
    closedReason,
    closedUntil,
  }
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
  // No business at all is an identity failure and stays unavailable.
  if (!platformBusinessId) return empty
  // A business with no platform Store row still has an answer — see
  // businessLevelAvailability. It is not "unavailable" to its customers.
  if (!sid) {
    const { isOnline, result, closedReason, closedUntil } = await businessLevelAvailability(platformBusinessId)
    return {
      ...empty,
      isOnline,
      isOpen: result.isOpen,
      reason: result.isOpen ? null : (result.reason || null),
      opensAt: result.opensAt || null,
      closedReason,
      closedUntil: closedUntil ? closedUntil.toISOString() : null,
      status: result.isOpen ? "open" : "closed",
    }
  }

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
  // A day configured as 00:00–23:59 reads as "Open 24 hours" rather than
  // "12:00 AM – 11:59 PM", which is the same fact stated unhelpfully.
  const businessHours = todayRow && !todayRow.isClosed
    ? (todayRow.openTime === "00:00" && todayRow.closeTime === "23:59"
      ? "Open 24 hours"
      : `${formatTimeLabel(todayRow.openTime)} – ${formatTimeLabel(todayRow.closeTime)}`)
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
    // 24/7 Customer Ordering relaxes the WEEKLY SCHEDULE, and only that. A
    // weekly off-day says nothing about whether the customer may ORDER — it is
    // the shop's normal working pattern, not a decision to stop trading.
    // A declared closure IS that decision, and still closes the date.
    if (opts?.ignoreWorkingHours && !closureCoversDate(dateISO, closedUntil)) {
      return { available: true, reason: null, openTime: null, closeTime: null }
    }
    return { available: false, reason: res.reason || "Unavailable", openTime: null, closeTime: null }
  }
  return { available: true, reason: null, openTime: res.openTime || null, closeTime: res.closeTime || null }
}

// Which of the tenant's configured pickup/delivery slots are offered on a date.
//
// Default (FOLLOW_STORE_HOURS): the weekly schedule governs — a closed day
// offers nothing, and an open day offers only the slots inside its hours.
//
// 24/7 Customer Ordering (`ignoreWorkingHours`): the tenant's CONFIGURED slot
// window is the offer, on every calendar day. The weekly schedule neither
// closes the day nor clips the window — a shop that takes orders round the
// clock has already said its working pattern is not what limits the customer.
// Without this, a 24/7 tenant with Friday marked closed showed the date as
// bookable and then offered zero slots, so the dropdown had nothing in it.
//
// A DECLARED closure still empties the day in BOTH modes: that is a decision
// not to trade, and 24/7 ordering is not a way around it. Past dates and
// delivery capacity are enforced by their own callers, unchanged.
export function laundrySlotsForDate(
  slots: string[],
  timings: StoreDayTiming[],
  dateISO: string | null | undefined,
  closedUntil?: string | Date | null,
  opts?: { ignoreWorkingHours?: boolean },
): string[] {
  if (!dateISO) return slots
  if (closureCoversDate(dateISO, closedUntil)) return []
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
  const { storeId: sid, platformBusinessId } = await resolvePlatformStore(input, storeId)
  // Only an unidentifiable business is "unavailable". A missing store row is
  // answered at business level instead of refused.
  if (!sid) {
    if (!platformBusinessId) return { ok: false, error: "Store is currently unavailable", opensAt: null }
    const { result } = await businessLevelAvailability(platformBusinessId)
    if (!result.isOpen) return { ok: false, error: result.reason || "Store is currently closed", opensAt: result.opensAt ?? null, reason: result.reason || null }
    return { ok: true }
  }
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
): Promise<{ ok: true; storeId: string | null } | { ok: false; error: string }> {
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

  const { storeId, platformBusinessId } = await resolvePlatformStore(input, opts.storeId)
  if (!storeId && !platformBusinessId) return { ok: false, error: "Store is currently unavailable" }
  const store = storeId
    ? await prisma.store.findUnique({
        where: { id: storeId },
        select: { closedUntil: true, storeTimings: { orderBy: { day: "asc" } } },
      })
    : null
  // With no store row there is no weekly schedule and no declared closure, so
  // the date and slot checks below run against exactly that: an empty schedule
  // and no closure. They are still RUN — a past date is still refused, and the
  // rules themselves are untouched.
  const schedule = store?.storeTimings ?? []
  const closedUntil = store?.closedUntil ?? null

  const checks: { date?: string | null; slot?: string | null; label: string }[] = [
    { date: opts.pickupDate, slot: opts.pickupSlot, label: "Pickup" },
    { date: opts.deliveryDate, slot: opts.deliverySlot, label: "Standard delivery" },
    { date: opts.backupDate, slot: opts.backupSlot, label: "Backup delivery" },
  ]
  for (const c of checks) {
    if (!c.date) continue
    // Past dates and declared closures are always rejected. Under 24/7 Customer
    // Ordering a weekly OFF-DAY is not: it says nothing about whether the
    // customer may order, and answering it here is what produced a
    // store-flavoured "Closed on Friday" the moment a date was picked. The
    // schedule is enforced a few lines below, on the SLOT, where it belongs.
    const a = assertLaundryDateAvailable(schedule, c.date, c.label, closedUntil, {
      ignoreWorkingHours: bypassesStoreHours(ordering),
    })
    if (!a.ok) return a
    // The slot is where the operational schedule is enforced, in EVERY mode.
    // laundrySlotsForDate() returns nothing at all for a closed day, so a slot
    // on a weekly off-day or a holiday is rejected here even when ordering is
    // 24/7 — this is the check that keeps pickup/delivery on the shop's hours.
    // (slotsWithinWorkingHours alone could not: on a closed day it has no
    // open/close window to compare against and passes the slot through.)
    if (c.slot) {
      // Same interpretation as the public slots API — otherwise the website
      // offers a slot the server then refuses.
      if (laundrySlotsForDate([c.slot], schedule, c.date, closedUntil, {
        ignoreWorkingHours: bypassesStoreHours(ordering),
      }).length === 0) {
        return { ok: false, error: `${c.label} time ${c.slot} is outside business hours on ${c.date}. Please choose another slot.` }
      }
    }
  }
  // Null when the business has no platform Store row. No caller reads it — the
  // order routes resolve their own LaundryStore for branch and serviceability —
  // and reporting "" would claim a store that does not exist.
  return { ok: true, storeId }
}
