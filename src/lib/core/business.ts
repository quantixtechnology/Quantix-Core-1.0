// ============================================================================
// QUANTIX CORE PLATFORM — Business Management Library
// Managed by Quantix Super Admin ONLY. Businesses cannot self-signup.
// NO free trial — business created ONLY after payment verified.
// ============================================================================

import { db } from '@/lib/db';
import { hashPassword } from '@/lib/password-utils';
import type {
  BusinessListFilters,
  BusinessStats,
  BusinessTypeModuleDefaults,
  CreateBusinessRequest,
  UpdateBusinessRequest,
  BusinessType,
  BusinessStatus,
  OnboardingStepStatus,
  OnboardingStepInfo,
  OnboardingProgress,
  LeadStage,
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
// DEFAULT ONBOARDING STEPS
// ============================================================================

const DEFAULT_ONBOARDING_STEPS = [
  { stepKey: 'business_setup', stepName: 'Business Setup', order: 1 },
  { stepKey: 'branding', stepName: 'Branding & Theme', order: 2 },
  { stepKey: 'store_config', stepName: 'Store Configuration', order: 3 },
  { stepKey: 'product_catalog', stepName: 'Product Catalog Setup', order: 4 },
  { stepKey: 'delivery_zones', stepName: 'Delivery Zones', order: 5 },
  { stepKey: 'payment_setup', stepName: 'Payment Gateway Setup', order: 6 },
  { stepKey: 'staff_onboarding', stepName: 'Staff Onboarding', order: 7 },
  { stepKey: 'domain_mapping', stepName: 'Domain & SSL', order: 8 },
  { stepKey: 'go_live', stepName: 'Go Live Review', order: 9 },
] as const;

// ============================================================================
// CREATE BUSINESS — From verified lead only
// ============================================================================

/**
 * Create a new business from a verified lead.
 * Called ONLY by Quantix Super Admin after payment has been verified.
 * The lead must be at stage PAYMENT_RECEIVED or later.
 * Auto-creates BusinessSubscription as ACTIVE, enables default modules,
 * creates onboarding steps, and creates a main store.
 */
export async function createBusiness(data: CreateBusinessRequest) {
  // 1. Check slug uniqueness
  const existing = await db.business.findUnique({ where: { slug: data.slug } });
  if (existing) {
    throw new Error(`Business with slug "${data.slug}" already exists`);
  }

  // 2. Validate lead if provided — lead must be at PAYMENT_RECEIVED or later
  if (data.leadId) {
    const lead = await db.lead.findUnique({ where: { id: data.leadId } });
    if (!lead) {
      throw new Error(`Lead "${data.leadId}" not found`);
    }
    const validStages: LeadStage[] = ['PAYMENT_RECEIVED', 'ONBOARDING', 'DEPLOYMENT'];
    if (!validStages.includes(lead.stage as LeadStage)) {
      throw new Error(
        `Lead must be at PAYMENT_RECEIVED stage or later to create a business. Current stage: ${lead.stage}`
      );
    }
  }

  // 3. Find or use provided plan
  let planId = data.planId;
  if (!planId) {
    // Default to STANDARD MONTHLY plan using compound unique key
    const defaultPlan = await db.platformPlan.findUnique({
      where: { tier_billingCycle: { tier: 'STANDARD', billingCycle: 'MONTHLY' } },
    });
    if (!defaultPlan) {
      throw new Error('No STANDARD MONTHLY plan found. Please seed platform plans first.');
    }
    planId = defaultPlan.id;
  }

  const plan = await db.platformPlan.findUnique({ where: { id: planId } });
  if (!plan) {
    throw new Error(`Platform plan "${planId}" not found`);
  }

  // 4. Determine pricing — plan price is the base, custom price overrides (Super Admin)
  const billingCycle = data.billingCycle || 'MONTHLY';
  const planPrice = plan.price;
  const effectivePrice = data.customPrice ?? planPrice;
  const hasOverride = data.customPrice !== undefined && data.customPrice !== planPrice;
  const now = new Date();
  const periodStart = now;
  const periodEnd = new Date(now.getTime() + (billingCycle === 'YEARLY' ? 365 : 30) * 24 * 60 * 60 * 1000);

  // 5. Create business + subscription + modules + onboarding steps + main store in a transaction
  const result = await db.$transaction(async (tx) => {
    // Create business — status is ONBOARDING (will be set to ACTIVE after deployment)
    const business = await tx.business.create({
      data: {
        name: data.name,
        slug: data.slug,
        businessType: data.businessType as BusinessType,
        status: 'ONBOARDING',
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
        settings: JSON.stringify({
          ecommerceConfig: {
            banners: [],
            theme: 'default',
            homepageStyle: 'grid',
            font: 'inter',
          },
        }),
        features: '{}',
        notificationConfig: '{}',
      },
    });

    // Create business subscription — starts as ACTIVE (NO TRIAL)
    await tx.businessSubscription.create({
      data: {
        businessId: business.id,
        planId: planId,
        status: 'ACTIVE',
        planPrice: planPrice,
        customPrice: data.customPrice,
        discountPercentage: hasOverride && planPrice > 0
          ? Math.round(((planPrice - (data.customPrice || 0)) / planPrice) * 100 * 100) / 100
          : null,
        manualPriceOverride: hasOverride,
        overrideReason: data.overrideReason,
        billingCycle: billingCycle === 'YEARLY' ? 'YEARLY' : 'MONTHLY',
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        nextBillingDate: periodEnd,
        nextPaymentAmount: effectivePrice,
        autoRenew: true,
        lastPaymentDate: now,
        lastPaymentAmount: effectivePrice,
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
          status: 'ENABLED',
          enabledAt: new Date(),
        })),
      });
    }

    // Create onboarding steps
    await tx.onboardingStep.createMany({
      data: DEFAULT_ONBOARDING_STEPS.map((step) => ({
        businessId: business.id,
        stepKey: step.stepKey,
        stepName: step.stepName,
        status: 'PENDING',
        sortOrder: step.order,
      })),
    });

    // Create main store with delivery config + default timings
    const storeSlug = data.slug;
    const mainStore = await tx.store.create({
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
        deliveryRadius: 5.0,
        deliveryFee: 0,
        minOrderAmount: 0,
        preparationTime: 30,
        settings: '{}',
        printerConfig: '{}',
        operatingHours: '{}',
      },
    });

    // Auto-create default 9am–9pm timings for all 7 days
    const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    await tx.storeTiming.createMany({
      data: DAY_NAMES.map((_, day) => ({
        storeId: mainStore.id,
        day,
        openTime: '09:00',
        closeTime: '21:00',
        isClosed: false,
      })),
    });

    // Always create a domain mapping — use custom domain if provided, otherwise auto-generate subdomain
    const storefrontBaseDomain = process.env.NEXT_PUBLIC_STOREFRONT_DOMAIN || 'quantixshop.in';
    await tx.domainMapping.create({
      data: {
        businessId: business.id,
        domain: data.domain || `${data.slug}.${storefrontBaseDomain}`,
        subdomain: data.subdomain || data.slug,
        isPrimary: true,
        status: 'PENDING_DNS',
      },
    });

    // Update lead if provided
    if (data.leadId) {
      await tx.lead.update({
        where: { id: data.leadId },
        data: {
          stage: 'ONBOARDING',
          convertedBusinessId: business.id,
        },
      });
    }

    // Create owner user and BusinessUser record
    const ownerEmail = data.ownerEmail || `owner@${data.slug}.in`;
    const rawPassword = data.ownerPassword || `${data.name.replace(/[^a-zA-Z0-9]/g, '')}@123`;
    const ownerPasswordHash = await hashPassword(rawPassword);
    const ownerName = data.ownerName || `${data.name} Owner`;

    const ownerUser = await tx.user.create({
      data: {
        email: ownerEmail,
        name: ownerName,
        phone: data.contactPhone || null,
        passwordHash: ownerPasswordHash,
        authProvider: 'PASSWORD',
        emailVerified: false,
        isActive: true,
      },
    });

    await tx.businessUser.create({
      data: {
        userId: ownerUser.id,
        businessId: business.id,
        role: 'CLIENT_OWNER',
        isActive: true,
        invitedAt: new Date(),
        acceptedAt: new Date(),
      },
    });

    // Log activity
    await tx.activityLog.create({
      data: {
        businessId: business.id,
        action: 'business.created',
        entity: 'Business',
        entityId: business.id,
        details: JSON.stringify({
          name: data.name,
          businessType: data.businessType,
          billingCycle,
          planPrice,
          customPrice: data.customPrice,
          leadId: data.leadId,
          ownerEmail,
        }),
      },
    });

    return { business, ownerEmail, ownerPassword: rawPassword, ownerUserId: ownerUser.id };
  });

  // Return the created business with relations plus owner credentials
  const business = await getBusiness(result.business.id);
  return {
    ...business,
    ownerCredentials: {
      email: result.ownerEmail,
      password: result.ownerPassword,
      userId: result.ownerUserId,
    },
  };
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

  const updated = await db.business.update({
    where: { id: businessId },
    data: updateData,
  });

  // Handle domain upsert (only when domain is explicitly provided)
  if (data.domain !== undefined && data.domain !== '') {
    const existingByDomain = await db.domainMapping.findUnique({ where: { domain: data.domain } });
    if (existingByDomain && existingByDomain.businessId !== businessId) {
      throw new Error(`Domain "${data.domain}" is already mapped to another business`);
    }
    await db.domainMapping.upsert({
      where: { businessId },
      create: {
        businessId,
        domain: data.domain,
        subdomain: data.subdomain ?? null,
        status: 'PENDING_DNS',
      },
      update: {
        domain: data.domain,
        subdomain: data.subdomain !== undefined ? data.subdomain : undefined,
        status: 'PENDING_DNS',
      },
    });
  }

  return updated;
}

// ============================================================================
// GET BUSINESS
// ============================================================================

/**
 * Get business with subscription, modules, onboarding steps, and store count.
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
      onboardingSteps: {
        orderBy: { sortOrder: 'asc' },
      },
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
        _count: {
          select: { stores: true },
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
 * Enforces valid transitions (NO TRIAL):
 *   ONBOARDING → ACTIVE → SUSPENDED → ACTIVE | CHURNED
 *   ACTIVE → CHURNED
 *   SUSPENDED → CHURNED
 *   ONBOARDING → SUSPENDED (if payment issue during onboarding)
 */
const VALID_STATUS_TRANSITIONS: Record<string, BusinessStatus[]> = {
  ONBOARDING: ['ACTIVE', 'SUSPENDED', 'CHURNED'],
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

  if (newStatus === 'ACTIVE') {
    updateData.activatedAt = new Date();
    updateData.onboardedAt = new Date();
  } else if (newStatus === 'SUSPENDED') {
    updateData.suspendedAt = new Date();
    updateData.isOnline = false;
  }

  // Update subscription status in tandem
  const subscriptionStatusMap: Record<string, 'ACTIVE' | 'SUSPENDED' | 'CANCELLED'> = {
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
  const business = await db.business.findUnique({
    where: { id: businessId },
    include: { businessSubscription: true },
  });

  if (!business) {
    throw new Error(`Business "${businessId}" not found`);
  }

  if (isOnline) {
    if (business.status === 'SUSPENDED') {
      throw new Error('Cannot set a suspended business online. Activate it first.');
    }
    if (!business.businessSubscription || business.businessSubscription.status !== 'ACTIVE') {
      throw new Error('Cannot set business online without an active subscription. Activate the subscription first.');
    }
  }

  return db.business.update({
    where: { id: businessId },
    data: { isOnline },
  });
}

// ============================================================================
// ONBOARDING STEP MANAGEMENT
// ============================================================================

/**
 * Get onboarding progress for a business.
 */
export async function getOnboardingProgress(businessId: string): Promise<OnboardingProgress> {
  const steps = await db.onboardingStep.findMany({
    where: { businessId },
    orderBy: { sortOrder: 'asc' },
  });

  const totalSteps = steps.length;
  const completedSteps = steps.filter((s) => s.status === 'COMPLETED').length;
  const currentStep = steps.find((s) => s.status === 'PENDING' || s.status === 'IN_PROGRESS')?.stepKey || null;
  const progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  return {
    businessId,
    totalSteps,
    completedSteps,
    currentStep,
    progress,
    steps: steps.map((s) => ({
      id: s.id,
      stepKey: s.stepKey,
      stepName: s.stepName,
      status: s.status as OnboardingStepStatus,
      completedAt: s.completedAt,
      notes: s.notes,
    })),
  };
}

/**
 * Update the status of an onboarding step.
 */
export async function updateOnboardingStep(
  businessId: string,
  stepKey: string,
  status: OnboardingStepStatus,
  notes?: string
): Promise<OnboardingStepInfo> {
  const step = await db.onboardingStep.findFirst({
    where: { businessId, stepKey },
  });

  if (!step) {
    throw new Error(`Onboarding step "${stepKey}" not found for business "${businessId}"`);
  }

  const updated = await db.onboardingStep.update({
    where: { id: step.id },
    data: {
      status,
      completedAt: status === 'COMPLETED' ? new Date() : null,
      notes: notes || step.notes,
    },
  });

  // Log activity
  await db.activityLog.create({
    data: {
      businessId,
      action: 'business.onboarding_step_updated',
      entity: 'OnboardingStep',
      entityId: updated.id,
      details: JSON.stringify({ stepKey, status, notes }),
    },
  });

  return {
    id: updated.id,
    stepKey: updated.stepKey,
    stepName: updated.stepName,
    status: updated.status as OnboardingStepStatus,
    completedAt: updated.completedAt,
    notes: updated.notes,
  };
}

/**
 * Complete all onboarding steps and activate the business.
 * Called by Super Admin after go-live review.
 */
export async function completeOnboarding(businessId: string): Promise<void> {
  // Mark all remaining pending steps as completed
  await db.onboardingStep.updateMany({
    where: {
      businessId,
      status: { in: ['PENDING', 'IN_PROGRESS'] },
    },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
    },
  });

  // Update business status to ACTIVE
  await updateBusinessStatus(businessId, 'ACTIVE', 'Onboarding completed successfully');

  // Update lead stage if linked
  const lead = await db.lead.findFirst({
    where: { convertedBusinessId: businessId },
  });
  if (lead) {
    await db.lead.update({
      where: { id: lead.id },
      data: { stage: 'ACTIVE' },
    });
  }
}

// ============================================================================
// LEAD-TO-BUSINESS CONVERSION
// ============================================================================

/**
 * Convert a lead to a business.
 * Only callable by Quantix Super Admin.
 * The lead must be at PAYMENT_RECEIVED stage.
 */
export async function convertLeadToBusiness(params: {
  leadId: string;
  planId?: string;
  billingCycle?: 'MONTHLY' | 'YEARLY';
  customPrice?: number;
  overrideReason?: string;
  domain?: string;
  subdomain?: string;
  primaryColor?: string;
  secondaryColor?: string;
}): Promise<unknown> {
  const lead = await db.lead.findUnique({ where: { id: params.leadId } });
  if (!lead) {
    throw new Error(`Lead "${params.leadId}" not found`);
  }

  const validStages: LeadStage[] = ['PAYMENT_RECEIVED', 'ONBOARDING'];
  if (!validStages.includes(lead.stage as LeadStage)) {
    throw new Error(
      `Lead must be at PAYMENT_RECEIVED stage to convert. Current stage: ${lead.stage}`
    );
  }

  // Generate slug from business name
  const slug = lead.businessName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  return createBusiness({
    name: lead.businessName,
    slug,
    businessType: lead.businessType as BusinessType,
    contactEmail: lead.contactEmail,
    contactPhone: lead.contactPhone,
    planId: params.planId,
    billingCycle: params.billingCycle || 'MONTHLY',
    customPrice: params.customPrice,
    overrideReason: params.overrideReason,
    domain: params.domain,
    subdomain: params.subdomain,
    primaryColor: params.primaryColor,
    secondaryColor: params.secondaryColor,
    leadId: params.leadId,
    salesRepId: lead.salesRepId ?? undefined,
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
