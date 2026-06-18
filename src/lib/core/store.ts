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

    // Create store
    const store = await tx.store.create({
      data: {
        businessId,
        name: data.name,
        slug: data.slug,
        storeType: data.storeType as any || undefined,
        code: data.code,
        storeCode,
        address: data.address,
        city: data.city,
        state: data.state,
        pincode: data.pincode,
        latitude: data.latitude,
        longitude: data.longitude,
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
    'deliveryRadius', 'minOrderAmount', 'deliveryFee',
    'freeDeliveryAbove', 'preparationTime',
    'posEnabled', 'gstNumber', 'paperSize', 'printerType',
  ] as const;

  for (const field of directFields) {
    if ((data as Record<string, unknown>)[field] !== undefined) {
      updateData[field] = (data as Record<string, unknown>)[field];
    }
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
// STORE OPEN/CLOSE ENFORCEMENT
// ============================================================================

interface StoreOpenResult {
  isOpen: boolean;
  reason?: string;
  opensAt?: string;
}

/**
 * Check whether a store is currently accepting orders.
 * Checks (in order):
 *   1. business.isOnline — platform-level online/offline toggle
 *   2. store.status      — must be ACTIVE
 *   3. store timings     — current IST time must be within open window
 *
 * Returns { isOpen: true } when all checks pass.
 * Returns { isOpen: false, reason: "..." } with a customer-friendly message.
 */
export async function checkStoreOpen(storeId: string): Promise<StoreOpenResult> {
  const store = await db.store.findUnique({
    where: { id: storeId },
    select: {
      id: true,
      status: true,
      businessId: true,
      storeTimings: { orderBy: { day: 'asc' } },
    },
  });

  if (!store) {
    return { isOpen: false, reason: 'Store not found' };
  }

  if (store.status !== 'ACTIVE') {
    return { isOpen: false, reason: 'Store is currently offline' };
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
  if (store.storeTimings.length > 0) {
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
