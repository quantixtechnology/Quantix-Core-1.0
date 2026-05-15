// ============================================================================
// QUANTIX CORE PLATFORM — Store Management Library
// Multi-store per business. Auto-creates store timings on creation.
// ============================================================================

import { db } from '@/lib/db';
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

  // 2. Enforce subscription store limit — read plan.maxStores (never hardcode plan names)
  const subscription = await db.businessSubscription.findUnique({
    where: { businessId },
    include: { plan: true },
  });
  if (subscription?.plan) {
    const maxStores = subscription.plan.maxStores;
    const currentCount = business._count.stores;
    // maxStores <= 0 is treated as unlimited
    if (maxStores > 0 && currentCount >= maxStores) {
      throw new Error(
        `Store limit reached. Your current plan allows ${maxStores} store${maxStores === 1 ? '' : 's'}. Upgrade your plan to add more stores.`
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
        code: data.code,
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
        settings: '{}',
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

  // Return store with timings
  return getStore(result.id);
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
