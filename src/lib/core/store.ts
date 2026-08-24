// ============================================================================
// QUANTIX CORE PLATFORM — Store Management Library
// Multi-store per business. Auto-creates store timings on creation.
// ============================================================================

import { db } from '@/lib/db';
import { hashPassword } from '@/lib/password-utils';
import type {
  CreateStoreRequest,
  StoreTimingInput,
  DefaultStoreTiming,
  StoreStatus,
} from '@/lib/core/types';

// ============================================================================
// DEFAULT STORE TIMINGS (9am–9pm, all 7 days)
// ============================================================================

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Returns default 7-day timings (9am–9pm, all days open).
 */
export function getDefaultStoreTimings(): DefaultStoreTiming[] {
  return DAY_NAMES.map((dayName, index) => ({
    day: index,
    dayName,
    openTime: '09:00',
    closeTime: '21:00',
    isClosed: false,
  }));
}

// ============================================================================
// STORE CODE GENERATION
// ============================================================================

// Store code format: STR-{businessCode}-{pad3(seq)} e.g. STR-BUS-202605-0002-001
const STORE_CODE_REGEX = /^STR-BUS-\d{6}-\d{4}-\d{3}$/

/**
 * Generate next store code for a business: STR-{businessCode}-{pad3(seq)}.
 * Format: STR-BUS-202605-0001-001, STR-BUS-202605-0001-002, ...
 * Per-business unique. Main store of every business always gets -001.
 */
export async function generateStoreCode(businessId: string): Promise<string> {
  const business = await db.business.findUnique({
    where: { id: businessId },
    select: { businessCode: true },
  });
  const businessCode = business?.businessCode;
  if (!businessCode) throw new Error(`Business ${businessId} has no businessCode assigned yet`);

  let seq = (await db.store.count({ where: { businessId } })) + 1;
  let candidate = `STR-${businessCode}-${String(seq).padStart(3, '0')}`;
  // Collision guard (handles concurrent store creation edge case)
  while (await db.store.findFirst({ where: { businessId, storeCode: candidate } })) {
    seq++;
    candidate = `STR-${businessCode}-${String(seq).padStart(3, '0')}`;
  }
  return candidate;
}

// ============================================================================
// GPS VALIDATION
// ============================================================================

/**
 * Validate the Google Maps location payload for a store. Coordinates must be
 * present together, and any coordinate set must be accompanied by a Google
 * Place ID so the stored location is always resolvable on the map.
 *
 * Throws a human-readable error when the payload is incomplete — the API layer
 * surfaces this to the UI so a store is never persisted with half a location.
 */
export function assertValidStoreLocation(data: {
  latitude?: number | null;
  longitude?: number | null;
  googlePlaceId?: string | null;
}) {
  const hasLat = typeof data.latitude === "number" && !Number.isNaN(data.latitude);
  const hasLng = typeof data.longitude === "number" && !Number.isNaN(data.longitude);

  if (hasLat !== hasLng) {
    throw new Error("Store location is incomplete: latitude and longitude must be provided together. Use the map to drop the store location.");
  }

  if (hasLat && hasLng) {
    const validLat = data.latitude! >= -90 && data.latitude! <= 90;
    const validLng = data.longitude! >= -180 && data.longitude! <= 180;
    if (!validLat || !validLng) {
      throw new Error("Store location is invalid: coordinates are outside the valid lat/lng ranges.");
    }
    if (!data.googlePlaceId) {
      throw new Error("Store location is missing its Google Place ID. Select the store on the map to capture the full location.");
    }
  }
}

// ============================================================================
// CREATE STORE
// ============================================================================

/**
 * Create a new store under a business. Auto-creates store timings.
 * If this is the first store, it is marked as main store automatically.
 */
export async function createStore(businessId: string, data: CreateStoreRequest) {
  // 1. Verify business exists
  const business = await db.business.findUnique({
    where: { id: businessId },
    include: { _count: { select: { stores: true } } },
  });
  if (!business) {
    throw new Error(`Business "${businessId}" not found`);
  }

  // 2. Enforce subscription store limit — reads allowedStores from BusinessSubscription
  const subscription = await db.businessSubscription.findUnique({
    where: { businessId },
    include: { plan: true },
  });
  if (subscription) {
    const allowedStores = subscription.allowedStores > 0
      ? subscription.allowedStores
      : (subscription.plan?.maxStores ?? 0);
    const currentCount = business._count.stores;
    // allowedStores <= 0 is treated as unlimited
    if (allowedStores > 0 && currentCount >= allowedStores) {
      throw new Error(
        `Store limit reached. Your subscription allows ${allowedStores} store${allowedStores === 1 ? '' : 's'}. Contact support to increase your store limit.`
      );
    }
  }

  // 3. Check slug uniqueness within business
  const slugExists = await db.store.findUnique({
    where: { businessId_slug: { businessId, slug: data.slug } },
  });
  if (slugExists) {
    throw new Error(`Store with slug "${data.slug}" already exists for this business`);
  }

  // 3. Determine if this should be main store
  const isFirstStore = business._count.stores === 0;
  const isMainStore = data.isMainStore ?? isFirstStore;

  // Generate store code before transaction (avoids nested async issues)
  const storeCode = await generateStoreCode(businessId)
  if (!storeCode || !STORE_CODE_REGEX.test(storeCode)) {
    throw new Error(`Invalid store code generated: "${storeCode}". Expected format: STR-BUS-YYYYMM-NNNN-NNN`)
  }

  // 4. If setting as main store, unset existing main store
  const result = await db.$transaction(async (tx) => {
    if (isMainStore) {
      await tx.store.updateMany({
        where: { businessId, isMainStore: true },
        data: { isMainStore: false },
      });
    }

    // Validate the Google Maps location payload before persisting.
    assertValidStoreLocation(data);

    // Create store
    const store = await tx.store.create({
      data: {
        businessId,
        name: data.name,
        slug: data.slug,
        code: data.code,
        storeCode,
        address: data.address,
        city: data.city,
        state: data.state,
        pincode: data.pincode,
        latitude: data.latitude,
        longitude: data.longitude,
        googlePlaceId: data.googlePlaceId ?? null,
        formattedAddress: data.formattedAddress ?? null,
        pickupRadiusKm: data.pickupRadiusKm ?? 5.0,
        defaultMapZoom: data.defaultMapZoom ?? 16,
        phone: data.phone,
        email: data.email,
        isMainStore,
        deliveryRadius: data.deliveryRadius ?? 5.0,
        minOrderAmount: data.minOrderAmount ?? 0,
        deliveryFee: data.deliveryFee ?? 0,
        freeDeliveryAbove: data.freeDeliveryAbove,
        preparationTime: data.preparationTime ?? 30,
        posEnabled: data.posEnabled ?? true,
        gstNumber: data.gstNumber,
        paperSize: data.paperSize ?? '80mm',
        printerType: data.printerType,
        status: 'ACTIVE',
        settings: (data as unknown as Record<string, unknown>).settings as string || '{}',
        printerConfig: '{}',
        operatingHours: '{}',
      },
    });

    // 5. Auto-create default store timings (9am–9pm, all days)
    const defaultTimings = getDefaultStoreTimings();
    await tx.storeTiming.createMany({
      data: defaultTimings.map((t) => ({
        storeId: store.id,
        day: t.day,
        openTime: t.openTime,
        closeTime: t.closeTime,
        isClosed: t.isClosed,
      })),
    });

    // Log activity
    await tx.activityLog.create({
      data: {
        businessId,
        action: 'store.created',
        entity: 'Store',
        entityId: store.id,
        details: JSON.stringify({ name: data.name, slug: data.slug, isMainStore }),
      },
    });

    return store;
  });

  // Optionally create store login credentials (default: true)
  let storeCredentials: { email: string; password: string; userId: string; loginId: string } | undefined;
  if (data.createLoginCredentials !== false) {
    const storeEmail = data.storeUserEmail || `store-${data.slug}@store.in`;
    const storeRawPassword = `Store@${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const storePasswordHash = await hashPassword(storeRawPassword);
    const storeUser = await db.user.create({
      data: {
        email: storeEmail,
        loginId: storeEmail,
        name: `${data.name}`,
        passwordHash: storePasswordHash,
        authProvider: 'PASSWORD',
        isActive: true,
      },
    });
    await db.businessUser.create({
      data: {
        userId: storeUser.id,
        businessId,
        storeId: result.id,
        role: 'STORE_MANAGER',
        isActive: true,
        invitedAt: new Date(),
        acceptedAt: new Date(),
      },
    });
    await db.activityLog.create({
      data: {
        businessId,
        action: 'store.login_created',
        entity: 'Store',
        entityId: result.id,
        details: JSON.stringify({ email: storeEmail, storeId: result.id }),
      },
    });
    storeCredentials = { email: storeEmail, password: storeRawPassword, userId: storeUser.id, loginId: storeEmail };
  }

  const storeWithTimings = await getStore(result.id);
  return { ...storeWithTimings, storeCredentials };
}

// ============================================================================
// UPDATE STORE
// ============================================================================

/**
 * Update store details. Only specified fields are updated.
 */
export async function updateStore(storeId: string, data: Partial<CreateStoreRequest>) {
  const store = await db.store.findUnique({ where: { id: storeId } });
  if (!store) {
    throw new Error(`Store "${storeId}" not found`);
  }

  // Build update data
  const updateData: Record<string, unknown> = {};

  const directFields = [
    'name', 'code', 'address', 'city', 'state', 'pincode',
    'latitude', 'longitude', 'phone', 'email',
    'googlePlaceId', 'formattedAddress', 'pickupRadiusKm', 'defaultMapZoom',
    'deliveryRadius', 'minOrderAmount', 'deliveryFee',
    'freeDeliveryAbove', 'preparationTime',
    'posEnabled', 'gstNumber', 'paperSize', 'printerType',
  ] as const;

  for (const field of directFields) {
    if ((data as Record<string, unknown>)[field] !== undefined) {
      updateData[field] = (data as Record<string, unknown>)[field];
    }
  }

  // Validate the Google Maps location payload whenever coordinates are being
  // changed — never persist a store with half a location.
  if ((data as Record<string, unknown>).latitude !== undefined || (data as Record<string, unknown>).longitude !== undefined) {
    assertValidStoreLocation(data as { latitude?: number; longitude?: number; googlePlaceId?: string | null });
  }

  // Merge settings JSON
  if ((data as Record<string, unknown>).settings !== undefined) {
    try {
      const incoming = JSON.parse((data as Record<string, unknown>).settings as string || '{}');
      const existing = JSON.parse(store.settings || '{}');
      updateData.settings = JSON.stringify({ ...existing, ...incoming });
    } catch {
      updateData.settings = (data as Record<string, unknown>).settings;
    }
  }

  // Handle slug change — check uniqueness
  if (data.slug && data.slug !== store.slug) {
    const slugExists = await db.store.findUnique({
      where: { businessId_slug: { businessId: store.businessId, slug: data.slug } },
    });
    if (slugExists) {
      throw new Error(`Store with slug "${data.slug}" already exists for this business`);
    }
    updateData.slug = data.slug;
  }

  // Handle main store toggle
  if (data.isMainStore !== undefined && data.isMainStore && !store.isMainStore) {
    // Unset existing main store
    await db.store.updateMany({
      where: { businessId: store.businessId, isMainStore: true },
      data: { isMainStore: false },
    });
    updateData.isMainStore = true;
  }

  return db.store.update({
    where: { id: storeId },
    data: updateData,
  });
}

// ============================================================================
// GET STORE
// ============================================================================

/**
 * Get store with timings.
 */
export async function getStore(storeId: string) {
  const store = await db.store.findUnique({
    where: { id: storeId },
    include: {
      storeTimings: {
        orderBy: { day: 'asc' },
      },
      business: {
        select: {
          id: true,
          name: true,
          slug: true,
          businessType: true,
          gstNumber: true,
        },
      },
      _count: {
        select: {
          orders: true,
          inventory: true,
          posSessions: true,
          staff: true,
        },
      },
    },
  });

  if (!store) {
    throw new Error(`Store "${storeId}" not found`);
  }

  return store;
}

// ============================================================================
// LIST STORES
// ============================================================================

/**
 * List all stores for a business.
 */
export async function listStores(businessId: string) {
  const business = await db.business.findUnique({ where: { id: businessId } });
  if (!business) {
    throw new Error(`Business "${businessId}" not found`);
  }

  const stores = await db.store.findMany({
    where: { businessId },
    include: {
      storeTimings: {
        orderBy: { day: 'asc' },
      },
      _count: {
        select: {
          orders: true,
          inventory: true,
          staff: true,
        },
      },
      staff: {
        where: { isActive: true },
        select: {
          id: true,
          role: true,
          isActive: true,
          user: {
            select: { id: true, name: true, email: true, phone: true, loginId: true },
          },
        },
      },
    },
    orderBy: [{ isMainStore: 'desc' }, { name: 'asc' }],
  });

  return stores;
}

// ============================================================================
// UPDATE STORE TIMINGS
// ============================================================================

/**
 * Update operating hours for a store.
 * Accepts an array of timings for each day (0=Sunday ... 6=Saturday).
 * Will upsert each timing record.
 */
export async function updateStoreTimings(
  storeId: string,
  timings: StoreTimingInput[]
) {
  const store = await db.store.findUnique({ where: { id: storeId } });
  if (!store) {
    throw new Error(`Store "${storeId}" not found`);
  }

  // Validate day values
  for (const timing of timings) {
    if (timing.day < 0 || timing.day > 6) {
      throw new Error(`Invalid day value: ${timing.day}. Must be 0-6 (Sunday-Saturday).`);
    }
  }

  // Upsert each timing
  const results = await db.$transaction(
    timings.map((timing) =>
      db.storeTiming.upsert({
        where: {
          storeId_day: { storeId, day: timing.day },
        },
        create: {
          storeId,
          day: timing.day,
          openTime: timing.openTime,
          closeTime: timing.closeTime,
          isClosed: timing.isClosed ?? false,
        },
        update: {
          openTime: timing.openTime,
          closeTime: timing.closeTime,
          isClosed: timing.isClosed ?? false,
        },
      })
    )
  );

  // Also update the store's operatingHours JSON for quick reference
  const operatingHours: Record<string, { open: string; close: string; isClosed: boolean }> = {};
  for (const timing of timings) {
    operatingHours[DAY_NAMES[timing.day].toLowerCase().slice(0, 3)] = {
      open: timing.openTime,
      close: timing.closeTime,
      isClosed: timing.isClosed ?? false,
    };
  }
  await db.store.update({
    where: { id: storeId },
    data: { operatingHours: JSON.stringify(operatingHours) },
  });

  return results;
}

// ============================================================================
// STANDARD / DEFAULT STORE SCHEDULE
// A single reusable weekly schedule stored at the Business level (inside the
// Business.settings JSON under `standardStoreSchedule`). It is the baseline for
// every store/branch in the business; individual stores may override it with
// their own StoreTiming rows.
// ============================================================================

export interface StandardStoreSchedule {
  timings: { day: number; openTime: string; closeTime: string; isClosed: boolean }[];
  updatedAt?: string | null;
}

const STANDARD_SCHEDULE_KEY = 'standardStoreSchedule';

function readScheduleSettings(settings: string | null): Record<string, unknown> {
  try {
    return JSON.parse(settings || '{}') as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * Read the business-wide standard schedule from Business.settings JSON.
 * Falls back to the built-in default (9am–9pm) when none is configured.
 */
export async function getStandardStoreSchedule(businessId: string): Promise<StandardStoreSchedule> {
  const business = await db.business.findUnique({
    where: { id: businessId },
    select: { settings: true },
  });
  const parsed = readScheduleSettings(business?.settings ?? null);
  const stored = (parsed[STANDARD_SCHEDULE_KEY] as StandardStoreSchedule | undefined) ?? null;

  if (stored && Array.isArray(stored.timings) && stored.timings.length > 0) {
    return stored;
  }

  const fallback = getDefaultStoreTimings().map((t) => ({
    day: t.day, openTime: t.openTime, closeTime: t.closeTime, isClosed: t.isClosed,
  }));
  return { timings: fallback, updatedAt: null };
}

/**
 * Persist the standard weekly schedule to Business.settings JSON, preserving all
 * other settings keys.
 */
export async function setStandardStoreSchedule(
  businessId: string,
  timings: { day: number; openTime: string; closeTime: string; isClosed: boolean }[],
): Promise<StandardStoreSchedule> {
  const business = await db.business.findUnique({
    where: { id: businessId },
    select: { settings: true },
  });
  const parsed = readScheduleSettings(business?.settings ?? null);
  const next: StandardStoreSchedule = {
    timings: timings.map((t) => ({
      day: t.day, openTime: t.openTime, closeTime: t.closeTime,
      isClosed: t.isClosed ?? false,
    })),
    updatedAt: new Date().toISOString(),
  };
  parsed[STANDARD_SCHEDULE_KEY] = next;

  await db.business.update({
    where: { id: businessId },
    data: { settings: JSON.stringify(parsed) },
  });
  return next;
}

/**
 * Apply the business standard schedule to a store's StoreTiming rows (their
 * baseline). Stores keep their own rows afterwards — this overwrites them to the
 * standard values so "standard = default for all stores" holds.
 */
export async function applyStandardScheduleToStore(
  businessId: string,
  storeId: string,
): Promise<StoreTimingInput[]> {
  const std = await getStandardStoreSchedule(businessId);
  const upsertTimings: StoreTimingInput[] = std.timings.map((t) => ({
    day: t.day, openTime: t.openTime, closeTime: t.closeTime, isClosed: t.isClosed ?? false,
  }));
  await updateStoreTimings(storeId, upsertTimings);
  return upsertTimings;
}

// ============================================================================
// STORE OPEN/CLOSE ENFORCEMENT
// ============================================================================

export interface StoreOpenResult {
  isOpen: boolean;
  reason?: string;
  opensAt?: string;
}

// Day row shape shared by date/slot helpers.
export interface StoreDayTiming {
  day: number;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
}

// ISO weekday → 0=Sunday … 6=Saturday (matches StoreTiming.day).
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export const DAY_NAMES_SHORT = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// "HH:MM" (24h) → minutes since midnight. NaN on garbage.
function toMin(hhmm: string): number {
  const [h, m] = String(hhmm || '').split(':').map(Number);
  if (!Number.isFinite(h) || h < 0 || h > 23) return NaN;
  return h * 60 + (Number.isFinite(m) && m >= 0 && m <= 59 ? m : 0);
}

// minutes → "HH:MM" (24h)
function toHHMM(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

// "09:00" → "9:00 AM" (12h label used in customer-facing messages).
export function formatTimeLabel(hhmm: string): string {
  const min = toMin(hhmm);
  if (!Number.isFinite(min)) return hhmm || '';
  const h24 = Math.floor(min / 60);
  const m = min % 60;
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

// Format a closure re-open moment in IST, e.g. "2 Aug 2026, 9:00 AM".
export function formatReopenAt(date: Date | string | null | undefined): string | undefined {
  if (!date) return undefined;
  const d = new Date(date);
  if (isNaN(d.getTime())) return undefined;
  const ist = new Date(d.getTime() + IST_OFFSET_MS);
  const day = ist.getUTCDate();
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][ist.getUTCMonth()];
  const year = ist.getUTCFullYear();
  const hhmm = toHHMM(ist.getUTCHours() * 60 + ist.getUTCMinutes());
  return `${day} ${month} ${year}, ${formatTimeLabel(hhmm)}`;
}

// Which weekday (0=Sun…6=Sat) a yyyy-mm-dd calendar date falls on in IST.
// Order dates are persisted as `new Date("yyyy-mm-dd")` (UTC midnight = 5:30 AM
// IST the same day), so the IST weekday of a date string is the UTC weekday of
// its UTC-midnight Date. For a live timestamp, shift by the IST offset.
export function istWeekday(dateISO: string | Date): number {
  if (dateISO instanceof Date) {
    if (isNaN(dateISO.getTime())) return -1;
    return new Date(dateISO.getTime() + IST_OFFSET_MS).getUTCDay();
  }
  const d = new Date(`${dateISO}T00:00:00.000Z`);
  if (isNaN(d.getTime())) return -1;
  return d.getUTCDay();
}

// Business-hours row for a specific date, or null when the date is a weekly-off
// / holiday. `closedUntil` marks a temporary closure (holiday) — the date is
// unavailable while the closure window covers the start of that day.
export function timingForDate(
  timings: StoreDayTiming[],
  dateISO: string | Date,
  closedUntil?: Date | string | null,
): { available: boolean; reason?: string; openTime?: string; closeTime?: string; isClosed: boolean } {
  const day = istWeekday(dateISO);
  if (day < 0) return { available: false, reason: 'Invalid date', isClosed: true };

  const dateStart = new Date(dateISO instanceof Date ? dateISO : `${dateISO}T00:00:00.000Z`);
  if (closedUntil) {
    const until = new Date(closedUntil);
    if (!isNaN(until.getTime()) && dateStart.getTime() < until.getTime()) {
      return { available: false, reason: 'Closed for a holiday', isClosed: true };
    }
  }

  const row = timings.find((t) => t.day === day);
  if (!row || row.isClosed) {
    return { available: false, reason: `Closed on ${DAY_NAMES_SHORT[day]}`, isClosed: true };
  }
  return { available: true, openTime: row.openTime, closeTime: row.closeTime, isClosed: false };
}

// Intersect a list of "HH:MM - HH:MM" slots with a day's working hours so only
// slots fully inside business hours are offered.
export function slotsWithinWorkingHours(
  slots: string[],
  openTime: string | undefined,
  closeTime: string | undefined,
): string[] {
  if (!openTime || !closeTime) return slots || [];
  const openMin = toMin(openTime);
  const closeMin = toMin(closeTime);
  if (!Number.isFinite(openMin) || !Number.isFinite(closeMin)) return slots || [];
  return (slots || []).filter((slot) => {
    const [startStr, endStr] = String(slot).split('-').map((s) => s.trim());
    const startMin = toMin(startStr);
    const endMin = toMin(endStr);
    return Number.isFinite(startMin) && Number.isFinite(endMin) && startMin >= openMin && endMin <= closeMin;
  });
}

/**
 * Check whether a store is currently accepting orders.
 * Checks (in order):
 *   0. store.closedReason / closedUntil — admin "Temporarily Closed" override
 *   1. business.isOnline — platform-level online/offline toggle
 *   2. store.status      — must be ACTIVE
 *   3. store timings     — current IST time must be within open window
 *
 * Returns { isOpen: true } when all checks pass.
 * Returns { isOpen: false, reason: "..." } with a customer-friendly message.
 */
/**
 * @param opts.ignoreWorkingHours  Skip ONLY the scheduled-hours check.
 *   For a tenant on 24/7 Customer Ordering the clock no longer closes ordering
 *   — but "offline", "temporarily closed" and the operator's force-closed
 *   switch still do, because those are someone deciding not to trade rather
 *   than the hour of the day. See lib/customer-ordering.
 */
export async function checkStoreOpen(
  storeId: string,
  opts: { ignoreWorkingHours?: boolean } = {},
): Promise<StoreOpenResult> {
  const store = await db.store.findUnique({
    where: { id: storeId },
    select: {
      id: true,
      status: true,
      statusOverride: true,
      overrideExpiresAt: true,
      businessId: true,
      closedReason: true,
      closedUntil: true,
      storeTimings: { orderBy: { day: 'asc' } },
    },
  });

  if (!store) {
    return { isOpen: false, reason: 'Store not found' };
  }

  // Administrator override — takes precedence over every automatic check.
  // FORCE_OPEN ignores offline/timings/closure; FORCE_CLOSED closes regardless.
  // The override auto-expires once `overrideExpiresAt` passes (falls back to
  // automatic evaluation and clears the stale override).
  const override = resolveStatusOverride(store.statusOverride, store.overrideExpiresAt);
  if (override === 'FORCE_OPEN') {
    return { isOpen: true };
  }
  if (override === 'FORCE_CLOSED') {
    return { isOpen: false, reason: 'Store is temporarily closed by the operator' };
  }

  if (store.status !== 'ACTIVE') {
    return { isOpen: false, reason: 'Store is currently offline' };
  }

  // Temporarily Closed (optional reason + optional re-open time). A past
  // closedUntil is ignored → the store has automatically reopened.
  if (store.closedReason || store.closedUntil) {
    const stillClosed = !store.closedUntil || new Date(store.closedUntil).getTime() > Date.now();
    if (stillClosed) {
      const opensAt = store.closedUntil ? formatReopenAt(store.closedUntil) : _findNextOpenDay(store.storeTimings, istWeekday(new Date()));
      return {
        isOpen: false,
        reason: store.closedReason || 'Store is temporarily closed',
        opensAt,
      };
    }
  }

  // Check business online flag
  const business = await db.business.findUnique({
    where: { id: store.businessId },
    select: { isOnline: true },
  });

  if (!business || !business.isOnline) {
    return { isOpen: false, reason: 'Store is currently offline' };
  }

  // Check store timings (use IST — UTC+5:30)
  // Skipped entirely under 24/7 ordering: every deliberate closure above has
  // already had its say, and this branch is the only one about the clock.
  if (!opts.ignoreWorkingHours && store.storeTimings.length > 0) {
    const now = new Date();
    // Convert to IST
    const istOffset = 5.5 * 60 * 60 * 1000; // 5h30m in ms
    const istNow = new Date(now.getTime() + istOffset);
    // getUTCDay() on the shifted date gives the IST day-of-week (0=Sun … 6=Sat)
    const todayDay = istNow.getUTCDay();
    const currentMinutes = istNow.getUTCHours() * 60 + istNow.getUTCMinutes();

    const todayTiming = store.storeTimings.find((t) => t.day === todayDay);

    if (todayTiming) {
      if (todayTiming.isClosed) {
        // Find next open day
        const nextOpen = _findNextOpenDay(store.storeTimings, todayDay);
        return {
          isOpen: false,
          reason: 'Store is closed today',
          opensAt: nextOpen,
        };
      }

      const [openH, openM] = todayTiming.openTime.split(':').map(Number);
      const [closeH, closeM] = todayTiming.closeTime.split(':').map(Number);
      const openMinutes  = openH  * 60 + openM;
      const closeMinutes = closeH * 60 + closeM;

      if (currentMinutes < openMinutes) {
        return {
          isOpen: false,
          reason: `Store is not open yet. Opens at ${todayTiming.openTime}`,
          opensAt: todayTiming.openTime,
        };
      }
      if (currentMinutes >= closeMinutes) {
        const nextOpen = _findNextOpenDay(store.storeTimings, todayDay);
        return {
          isOpen: false,
          reason: `Store is closed. ${nextOpen ? `Opens ${nextOpen}` : 'Check timings for next opening'}`,
          opensAt: nextOpen,
        };
      }
    }
  }

  return { isOpen: true };
}

function _findNextOpenDay(
  timings: Array<{ day: number; isClosed: boolean; openTime: string }>,
  fromDay: number,
): string | undefined {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  for (let i = 1; i <= 7; i++) {
    const nextDay = (fromDay + i) % 7;
    const timing = timings.find((t) => t.day === nextDay);
    if (timing && !timing.isClosed) {
      const label = i === 1 ? 'Tomorrow' : dayNames[nextDay];
      return `${label} at ${timing.openTime}`;
    }
  }
  return undefined;
}

// ============================================================================
// STATUS OVERRIDE RESOLUTION (single source of truth for FORCE_OPEN/CLOSED)
// ============================================================================

export type StatusOverrideType = 'AUTOMATIC' | 'FORCE_OPEN' | 'FORCE_CLOSED';

/**
 * Resolve the effective override for a store/branch, honoring auto-expiry.
 * If `overrideExpiresAt` is set and now past, the override is treated as
 * AUTOMATIC (expired). Callers remain free to clear the stale column.
 */
export function resolveStatusOverride(
  statusOverride: StatusOverrideType | string | null | undefined,
  overrideExpiresAt?: Date | string | null,
): StatusOverrideType {
  if (statusOverride !== 'FORCE_OPEN' && statusOverride !== 'FORCE_CLOSED') return 'AUTOMATIC';
  if (overrideExpiresAt) {
    const exp = new Date(overrideExpiresAt);
    if (!isNaN(exp.getTime()) && exp.getTime() <= Date.now()) return 'AUTOMATIC';
  }
  return statusOverride;
}
