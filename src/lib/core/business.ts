// ============================================================================
// QUANTIX CORE PLATFORM — Business Management Library
// Managed by Quantix Super Admin ONLY. Businesses cannot self-signup.
// ============================================================================

import { db } from '@/lib/db';
import type {
  BusinessListFilters,
  BusinessStats,
  BusinessTypeModuleDefaults,
} from '@/lib/core/types';
import type {
  CreateBusinessRequest,
  UpdateBusinessRequest,
  BusinessType,
  BusinessStatus,
} from '@/lib/core/types';

// ============================================================================
// DEFAULT MODULES PER BUSINESS TYPE
// ============================================================================

const BUSINESS_TYPE_MODULES: Record<string, BusinessTypeModuleDefaults[]> = {
  GROCERY: [
    { moduleKey: 'grocery', moduleName: 'Grocery', status: 'ENABLED' },
    { moduleKey: 'catalog', moduleName: 'Catalog', status: 'ENABLED' },
    { moduleKey: 'delivery', moduleName: 'Delivery', status: 'ENABLED' },
    { moduleKey: 'pos', moduleName: 'POS', status: 'ENABLED' },
  ],
  FOOD_DELIVERY: [
    { moduleKey: 'restaurant', moduleName: 'Restaurant', status: 'ENABLED' },
    { moduleKey: 'catalog', moduleName: 'Catalog', status: 'ENABLED' },
    { moduleKey: 'delivery', moduleName: 'Delivery', status: 'ENABLED' },
    { moduleKey: 'pos', moduleName: 'POS', status: 'ENABLED' },
  ],
  LAUNDRY: [
    { moduleKey: 'laundry', moduleName: 'Laundry', status: 'ENABLED' },
    { moduleKey: 'delivery', moduleName: 'Delivery', status: 'ENABLED' },
    { moduleKey: 'subscription', moduleName: 'Subscription', status: 'ENABLED' },
  ],
  CAR_WASH: [
    { moduleKey: 'car_wash', moduleName: 'Car Wash', status: 'ENABLED' },
    { moduleKey: 'subscription', moduleName: 'Subscription', status: 'ENABLED' },
  ],
  PHARMACY: [
    { moduleKey: 'pharmacy', moduleName: 'Pharmacy', status: 'ENABLED' },
    { moduleKey: 'catalog', moduleName: 'Catalog', status: 'ENABLED' },
    { moduleKey: 'delivery', moduleName: 'Delivery', status: 'ENABLED' },
    { moduleKey: 'pos', moduleName: 'POS', status: 'ENABLED' },
  ],
  HOME_SERVICES: [
    { moduleKey: 'home_services', moduleName: 'Home Services', status: 'ENABLED' },
    { moduleKey: 'subscription', moduleName: 'Subscription', status: 'ENABLED' },
  ],
  ECOMMERCE: [
    { moduleKey: 'ecommerce', moduleName: 'E-Commerce', status: 'ENABLED' },
    { moduleKey: 'catalog', moduleName: 'Catalog', status: 'ENABLED' },
    { moduleKey: 'delivery', moduleName: 'Delivery', status: 'ENABLED' },
    { moduleKey: 'pos', moduleName: 'POS', status: 'ENABLED' },
  ],
  COSMETICS: [
    { moduleKey: 'cosmetics', moduleName: 'Cosmetics', status: 'ENABLED' },
    { moduleKey: 'catalog', moduleName: 'Catalog', status: 'ENABLED' },
    { moduleKey: 'delivery', moduleName: 'Delivery', status: 'ENABLED' },
    { moduleKey: 'pos', moduleName: 'POS', status: 'ENABLED' },
  ],
  MEAT_DELIVERY: [
    { moduleKey: 'meat_delivery', moduleName: 'Meat Delivery', status: 'ENABLED' },
    { moduleKey: 'catalog', moduleName: 'Catalog', status: 'ENABLED' },
    { moduleKey: 'delivery', moduleName: 'Delivery', status: 'ENABLED' },
    { moduleKey: 'pos', moduleName: 'POS', status: 'ENABLED' },
  ],
  FURNITURE: [
    { moduleKey: 'furniture', moduleName: 'Furniture', status: 'ENABLED' },
    { moduleKey: 'catalog', moduleName: 'Catalog', status: 'ENABLED' },
    { moduleKey: 'delivery', moduleName: 'Delivery', status: 'ENABLED' },
  ],
  DIRECTORY: [
    { moduleKey: 'directory', moduleName: 'Directory', status: 'ENABLED' },
  ],
};

// ============================================================================
// CREATE BUSINESS
// ============================================================================

/**
 * Create a new business (Quantix Super Admin only).
 * Auto-creates BusinessSubscription with trial, enables default modules
 * for business type, and creates a main store.
 */
export async function createBusiness(data: CreateBusinessRequest) {
  // 1. Check slug uniqueness
  const existing = await db.business.findUnique({ where: { slug: data.slug } });
  if (existing) {
    throw new Error(`Business with slug "${data.slug}" already exists`);
  }

  // 2. Find or use provided plan
  let planId = data.planId;
  if (!planId) {
    const starterPlan = await db.platformPlan.findFirst({
      where: { tier: 'STARTER', isActive: true },
    });
    if (!starterPlan) {
      throw new Error('No STARTER plan found. Please create a platform plan first.');
    }
    planId = starterPlan.id;
  }

  const plan = await db.platformPlan.findUnique({ where: { id: planId } });
  if (!plan) {
    throw new Error(`Platform plan "${planId}" not found`);
  }

  // 3. Determine pricing
  const billingCycle = data.billingCycle || 'monthly';
  const planPrice = billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
  const now = new Date();
  const trialDays = 14; // Default 14-day trial
  const trialStart = now;
  const trialEnd = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);
  const periodStart = now;
  const periodEnd = new Date(now.getTime() + (billingCycle === 'yearly' ? 365 : 30) * 24 * 60 * 60 * 1000);

  // 4. Create business + subscription + modules + main store in a transaction
  const result = await db.$transaction(async (tx) => {
    // Create business
    const business = await tx.business.create({
      data: {
        name: data.name,
        slug: data.slug,
        businessType: data.businessType as BusinessType,
        status: 'TRIAL',
        description: data.description,
        logo: data.logo,
        primaryColor: data.primaryColor || '#10B981',
        secondaryColor: data.secondaryColor,
        tagline: data.tagline,
        address: data.address,
        city: data.city,
        state: data.state,
        pincode: data.pincode,
        gstNumber: data.gstNumber,
        panNumber: data.panNumber,
        cinNumber: data.cinNumber,
        fssaiLicense: data.fssaiLicense,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone,
        supportEmail: data.supportEmail,
        supportPhone: data.supportPhone,
        salesRepId: data.salesRepId,
        trialStartsAt: trialStart,
        trialEndsAt: trialEnd,
        settings: '{}',
        features: '{}',
        notificationConfig: '{}',
      },
    });

    // Create business subscription with trial
    await tx.businessSubscription.create({
      data: {
        businessId: business.id,
        planId: planId,
        status: 'TRIAL',
        planPrice: planPrice,
        customPrice: data.customPrice,
        discountPercentage: data.discountPercentage,
        manualPriceOverride: data.manualPriceOverride || false,
        overrideReason: data.overrideReason,
        billingCycle: billingCycle,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        nextBillingDate: periodEnd,
        trialStart: trialStart,
        trialEnd: trialEnd,
        autoRenew: true,
      },
    });

    // Enable default modules for this business type
    const defaultModules = BUSINESS_TYPE_MODULES[data.businessType] || [];
    if (defaultModules.length > 0) {
      await tx.businessModule.createMany({
        data: defaultModules.map((m) => ({
          businessId: business.id,
          moduleKey: m.moduleKey,
          moduleName: m.moduleName,
          status: m.status === 'ENABLED' ? 'ENABLED' : 'TRIAL',
          enabledAt: new Date(),
        })),
      });
    }

    // Create main store
    const storeSlug = data.slug;
    await tx.store.create({
      data: {
        businessId: business.id,
        name: `${data.name} - Main Store`,
        slug: storeSlug,
        isMainStore: true,
        address: data.address,
        city: data.city,
        state: data.state,
        pincode: data.pincode,
        phone: data.contactPhone,
        email: data.contactEmail,
        status: 'ACTIVE',
        posEnabled: true,
        settings: '{}',
        printerConfig: '{}',
        operatingHours: '{}',
      },
    });

    // Create domain mapping if domain provided
    if (data.domain) {
      await tx.domainMapping.create({
        data: {
          businessId: business.id,
          domain: data.domain,
          subdomain: data.subdomain,
          isPrimary: true,
          status: 'PENDING_DNS',
        },
      });
    }

    return business;
  });

  // Return the created business with relations
  return getBusiness(result.id);
}

// ============================================================================
// UPDATE BUSINESS
// ============================================================================

/**
 * Update business details. Only specified fields are updated.
 */
export async function updateBusiness(
  businessId: string,
  data: UpdateBusinessRequest
) {
  const business = await db.business.findUnique({ where: { id: businessId } });
  if (!business) {
    throw new Error(`Business "${businessId}" not found`);
  }

  // Build update data — only include fields that are explicitly provided
  const updateData: Record<string, unknown> = {};

  const stringFields = [
    'name', 'description', 'logo', 'favicon', 'primaryColor', 'secondaryColor',
    'tagline', 'address', 'city', 'state', 'pincode', 'gstNumber', 'panNumber',
    'cinNumber', 'fssaiLicense', 'contactEmail', 'contactPhone', 'supportEmail',
    'supportPhone', 'timezone', 'defaultCurrency', 'defaultLocale',
  ] as const;

  for (const field of stringFields) {
    if ((data as Record<string, unknown>)[field] !== undefined) {
      updateData[field] = (data as Record<string, unknown>)[field];
    }
  }

  const booleanFields = ['darkMode', 'isOnline'] as const;
  for (const field of booleanFields) {
    if ((data as Record<string, unknown>)[field] !== undefined) {
      updateData[field] = (data as Record<string, unknown>)[field];
    }
  }

  // Handle JSON fields
  if (data.settings) {
    updateData.settings = JSON.stringify(data.settings);
  }
  if (data.features) {
    updateData.features = JSON.stringify(data.features);
  }
  if (data.notificationConfig) {
    updateData.notificationConfig = JSON.stringify(data.notificationConfig);
  }

  // Handle slug update — check uniqueness
  if (data.slug && data.slug !== business.slug) {
    const slugExists = await db.business.findUnique({ where: { slug: data.slug } });
    if (slugExists) {
      throw new Error(`Business with slug "${data.slug}" already exists`);
    }
    updateData.slug = data.slug;
  }

  // Handle business type change
  if (data.businessType && data.businessType !== business.businessType) {
    updateData.businessType = data.businessType;
  }

  return db.business.update({
    where: { id: businessId },
    data: updateData,
  });
}

// ============================================================================
// GET BUSINESS
// ============================================================================

/**
 * Get business with subscription, modules, and store count.
 */
export async function getBusiness(businessId: string) {
  const business = await db.business.findUnique({
    where: { id: businessId },
    include: {
      businessSubscription: {
        include: { plan: true },
      },
      modules: true,
      domain: true,
      _count: {
        select: {
          stores: true,
          orders: true,
          customers: true,
          deliveryPartners: true,
          businessUsers: true,
          products: true,
        },
      },
    },
  });

  if (!business) {
    throw new Error(`Business "${businessId}" not found`);
  }

  return business;
}

// ============================================================================
// LIST BUSINESSES
// ============================================================================

/**
 * List businesses with pagination, filtering by type/status/sales rep.
 */
export async function listBusinesses(filters?: BusinessListFilters) {
  const page = filters?.page || 1;
  const limit = filters?.limit || 20;
  const skip = (page - 1) * limit;

  // Build where clause
  const where: Record<string, unknown> = {};

  if (filters?.businessType) {
    const types = Array.isArray(filters.businessType)
      ? filters.businessType
      : [filters.businessType];
    where.businessType = { in: types };
  }

  if (filters?.status) {
    const statuses = Array.isArray(filters.status)
      ? filters.status
      : [filters.status];
    where.status = { in: statuses };
  }

  if (filters?.salesRepId) {
    where.salesRepId = filters.salesRepId;
  }

  if (filters?.isOnline !== undefined) {
    where.isOnline = filters.isOnline;
  }

  if (filters?.search) {
    where.OR = [
      { name: { contains: filters.search } },
      { slug: { contains: filters.search } },
      { contactEmail: { contains: filters.search } },
      { contactPhone: { contains: filters.search } },
      { city: { contains: filters.search } },
    ];
  }

  const [businesses, total] = await Promise.all([
    db.business.findMany({
      where,
      skip,
      take: limit,
      include: {
        businessSubscription: {
          select: { status: true, plan: { select: { name: true, tier: true } } },
        },
        domain: { select: { domain: true, status: true } },
        salesRep: { select: { name: true } },
        _count: {
          select: { stores: true, orders: true, customers: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    db.business.count({ where }),
  ]);

  return {
    data: businesses,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
  };
}

// ============================================================================
// UPDATE BUSINESS STATUS
// ============================================================================

/**
 * Change business status with validation.
 * Enforces valid transitions:
 *   ONBOARDING → TRIAL → ACTIVE → SUSPENDED → ACTIVE | CHURNED
 *   ACTIVE → CHURNED
 *   SUSPENDED → CHURNED
 */
const VALID_STATUS_TRANSITIONS: Record<string, BusinessStatus[]> = {
  ONBOARDING: ['TRIAL', 'SUSPENDED'],
  TRIAL: ['ACTIVE', 'SUSPENDED', 'CHURNED'],
  ACTIVE: ['SUSPENDED', 'CHURNED'],
  SUSPENDED: ['ACTIVE', 'CHURNED'],
  CHURNED: [], // Terminal state
};

export async function updateBusinessStatus(
  businessId: string,
  newStatus: BusinessStatus,
  reason?: string
) {
  const business = await db.business.findUnique({ where: { id: businessId } });
  if (!business) {
    throw new Error(`Business "${businessId}" not found`);
  }

  const currentStatus = business.status as BusinessStatus;

  // Validate transition
  if (currentStatus === newStatus) {
    throw new Error(`Business is already in "${newStatus}" status`);
  }

  const allowedTransitions = VALID_STATUS_TRANSITIONS[currentStatus] || [];
  if (!allowedTransitions.includes(newStatus)) {
    throw new Error(
      `Invalid status transition: ${currentStatus} → ${newStatus}. Allowed: [${allowedTransitions.join(', ')}]`
    );
  }

  // Build update data with appropriate timestamps
  const updateData: Record<string, unknown> = {
    status: newStatus,
  };

  if (newStatus === 'TRIAL') {
    updateData.trialStartsAt = new Date();
    updateData.trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  } else if (newStatus === 'ACTIVE') {
    updateData.activatedAt = new Date();
    updateData.onboardedAt = new Date();
  } else if (newStatus === 'SUSPENDED') {
    updateData.suspendedAt = new Date();
    updateData.isOnline = false;
  }

  // Update subscription status in tandem
  const subscriptionStatusMap: Record<string, string> = {
    TRIAL: 'TRIAL',
    ACTIVE: 'ACTIVE',
    SUSPENDED: 'SUSPENDED',
    CHURNED: 'CANCELLED',
  };

  const result = await db.$transaction(async (tx) => {
    const updated = await tx.business.update({
      where: { id: businessId },
      data: updateData,
    });

    // Sync subscription status
    const subStatus = subscriptionStatusMap[newStatus];
    if (subStatus) {
      await tx.businessSubscription.updateMany({
        where: { businessId },
        data: {
          status: subStatus,
          ...(newStatus === 'SUSPENDED' ? { pauseReason: reason } : {}),
          ...(newStatus === 'CHURNED' ? { cancelledAt: new Date(), cancelReason: reason } : {}),
        },
      });
    }

    // Log activity
    await tx.activityLog.create({
      data: {
        businessId,
        action: 'business.status_changed',
        entity: 'Business',
        entityId: businessId,
        details: JSON.stringify({ from: currentStatus, to: newStatus, reason }),
      },
    });

    return updated;
  });

  return result;
}

// ============================================================================
// TOGGLE ONLINE
// ============================================================================

/**
 * Toggle business online/offline status.
 */
export async function toggleOnline(businessId: string, isOnline: boolean) {
  const business = await db.business.findUnique({ where: { id: businessId } });
  if (!business) {
    throw new Error(`Business "${businessId}" not found`);
  }

  // Suspended businesses cannot go online
  if (isOnline && business.status === 'SUSPENDED') {
    throw new Error('Cannot set a suspended business online. Activate it first.');
  }

  return db.business.update({
    where: { id: businessId },
    data: { isOnline },
  });
}

// ============================================================================
// GET BUSINESS STATS
// ============================================================================

/**
 * Get aggregated stats for a business (orders, revenue, customers, etc.).
 */
export async function getBusinessStats(businessId: string): Promise<BusinessStats> {
  const business = await db.business.findUnique({ where: { id: businessId } });
  if (!business) {
    throw new Error(`Business "${businessId}" not found`);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    totalOrdersResult,
    todayOrdersResult,
    pendingOrdersResult,
    totalCustomersResult,
    activeStoresResult,
    totalProductsResult,
    totalDeliveryPartnersResult,
    revenueResult,
    todayRevenueResult,
  ] = await Promise.all([
    // Total orders
    db.order.count({ where: { businessId } }),

    // Today's orders
    db.order.count({
      where: {
        businessId,
        createdAt: { gte: today },
      },
    }),

    // Pending orders
    db.order.count({
      where: {
        businessId,
        status: { in: ['PENDING', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'PICKUP_ASSIGNED', 'PICKED_UP', 'PROCESSING', 'READY_FOR_DELIVERY'] },
      },
    }),

    // Total customers
    db.customer.count({ where: { businessId } }),

    // Active stores
    db.store.count({ where: { businessId, status: 'ACTIVE' } }),

    // Total products
    db.product.count({ where: { businessId } }),

    // Total delivery partners
    db.deliveryPartner.count({ where: { businessId } }),

    // Total revenue (from delivered orders)
    db.order.aggregate({
      where: { businessId, status: 'DELIVERED' },
      _sum: { totalAmount: true },
    }),

    // Today's revenue
    db.order.aggregate({
      where: {
        businessId,
        status: 'DELIVERED',
        createdAt: { gte: today },
      },
      _sum: { totalAmount: true },
    }),
  ]);

  const totalRevenue = revenueResult._sum.totalAmount || 0;
  const todayRevenue = todayRevenueResult._sum.totalAmount || 0;
  const avgOrderValue = totalOrdersResult > 0 ? totalRevenue / totalOrdersResult : 0;

  return {
    totalOrders: totalOrdersResult,
    totalRevenue,
    totalCustomers: totalCustomersResult,
    todayOrders: todayOrdersResult,
    todayRevenue,
    pendingOrders: pendingOrdersResult,
    activeStores: activeStoresResult,
    totalProducts: totalProductsResult,
    totalDeliveryPartners: totalDeliveryPartnersResult,
    avgOrderValue,
  };
}
