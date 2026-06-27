// ============================================================================
// QUANTIX CORE PLATFORM — Business Management Library
// Managed by Quantix Super Admin ONLY. Businesses cannot self-signup.
// NO free trial — business created ONLY after payment verified.
// ============================================================================

import { db } from '@/lib/db';
import { hashPassword } from '@/lib/password-utils';
import { generateStoreCode } from '@/lib/core/store';
import { triggerMobileProvisioning } from '@/lib/mobile-provision';
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
  AddOnItem,
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
const ALL_WORKFLOWS = ['ECOMMERCE', 'PICKUP_DELIVERY', 'APPOINTMENT', 'SUBSCRIPTION', 'POST_SERVICE_BILLING'] as const;

const BUSINESS_TYPE_DEFAULT_WORKFLOWS: Record<string, string[]> = {
  GROCERY:       ['ECOMMERCE', 'PICKUP_DELIVERY'],
  ECOMMERCE:     ['ECOMMERCE'],
  FOOD_DELIVERY: ['ECOMMERCE', 'PICKUP_DELIVERY'],
  LAUNDRY:       ['ECOMMERCE', 'PICKUP_DELIVERY', 'SUBSCRIPTION', 'POST_SERVICE_BILLING'],
  CAR_WASH:      ['ECOMMERCE', 'APPOINTMENT', 'SUBSCRIPTION', 'POST_SERVICE_BILLING'],
  PHARMACY:      ['ECOMMERCE', 'PICKUP_DELIVERY'],
  HOME_SERVICES: ['APPOINTMENT', 'POST_SERVICE_BILLING'],
  MEAT_DELIVERY: ['ECOMMERCE', 'PICKUP_DELIVERY'],
  COSMETICS:     ['ECOMMERCE'],
  FURNITURE:     ['ECOMMERCE'],
  DIRECTORY:     ['ECOMMERCE'],
};

export function resolveEnabledWorkflows(
  planTier: string,
  businessType: string,
  adminSelected?: string[],
): string[] {
  if (planTier === 'STANDARD') return ['ECOMMERCE'];
  const valid = new Set(ALL_WORKFLOWS as readonly string[]);
  if (Array.isArray(adminSelected) && adminSelected.length > 0) {
    const filtered = adminSelected.filter(w => valid.has(w));
    if (filtered.length > 0) return filtered;
  }
  return BUSINESS_TYPE_DEFAULT_WORKFLOWS[businessType] ?? ['ECOMMERCE'];
}

export function getBusinessEnabledWorkflows(
  businessType: string,
  planTier: string | undefined,
  settingsJson?: string | null,
): string[] {
  const tier = planTier || 'STANDARD';
  if (tier === 'STANDARD') return ['ECOMMERCE'];

  const settings = JSON.parse(settingsJson || '{}') as Record<string, unknown>;
  const fromSettings = settings.enabledWorkflows;
  if (Array.isArray(fromSettings) && fromSettings.length > 0) {
    const valid = new Set(ALL_WORKFLOWS as readonly string[]);
    const filtered = (fromSettings as string[]).filter(w => valid.has(w));
    if (filtered.length > 0) return filtered;
  }
  return BUSINESS_TYPE_DEFAULT_WORKFLOWS[businessType] ?? ['ECOMMERCE'];
}

export async function createBusiness(data: CreateBusinessRequest) {
  // 1. Check slug uniqueness
  const existing = await db.business.findUnique({ where: { slug: data.slug } });
  if (existing) {
    throw new Error(`Business with slug "${data.slug}" already exists`);
  }

  // 2. Validate lead if provided — business creation is fully manual, no stage gate
  if (data.leadId) {
    const lead = await db.lead.findUnique({ where: { id: data.leadId } });
    if (!lead) {
      throw new Error(`Lead "${data.leadId}" not found`);
    }
  }

  // 3. Find or use provided plan — plan is workflow feature access only, pricing is managed separately.
  const validPlanTiers = ['STANDARD', 'PRO'] as const;
  const requestedPlanTier = data.planTier || 'STANDARD';
  if (!validPlanTiers.includes(requestedPlanTier)) {
    throw new Error(`Invalid planTier "${requestedPlanTier}". Allowed values: STANDARD, PRO`);
  }

  let plan = null;
  if (data.planId) {
    plan = await db.platformPlan.findUnique({ where: { id: data.planId } });
    if (!plan) {
      throw new Error(`Platform plan "${data.planId}" not found`);
    }
    if (!validPlanTiers.includes(plan.tier as typeof validPlanTiers[number])) {
      throw new Error(`Platform plan "${data.planId}" has invalid tier "${plan.tier}". Allowed values: STANDARD, PRO`);
    }
    if (data.planTier && data.planTier !== plan.tier) {
      throw new Error(`planTier "${data.planTier}" does not match plan tier "${plan.tier}" for planId "${data.planId}".`);
    }
  } else {
    plan = await db.platformPlan.findUnique({ where: { tier: requestedPlanTier } });
    if (!plan) {
      throw new Error(`No ${requestedPlanTier} plan found. Please seed platform plans first.`);
    }
  }

  const planId = plan.id;

  // 4. Build billing structure — all amounts are admin-entered, none come from the plan
  const billingCycle = data.billingCycle || 'MONTHLY';
  const subscriptionAmount = data.subscriptionAmount ?? data.customPrice ?? 0;
  const discountAmount = data.discountAmount ?? 0;
  const finalAmount = subscriptionAmount - discountAmount;
  const implementationAmount = data.implementationAmount ?? null;

  // iOS billing
  const iosAppAmount = data.iosAppAmount ?? null;
  const iosDiscountAmount = data.iosDiscountAmount ?? null;
  const iosFinalAmount = iosAppAmount !== null ? iosAppAmount - (iosDiscountAmount ?? 0) : null;
  const iosSubscriptionCycle = data.iosSubscriptionCycle ?? null;

  // Add-ons serialized as JSON
  const addOnsJson = JSON.stringify(
    Array.isArray(data.addOns) ? data.addOns : []
  );

  const now = new Date();
  const periodStart = now;
  const cycleDays = billingCycle === 'YEARLY' ? 365 : billingCycle === 'HALF_YEARLY' ? 182 : billingCycle === 'QUARTERLY' ? 90 : 30;
  const periodEnd = new Date(now.getTime() + cycleDays * 24 * 60 * 60 * 1000);

  // 4a. Parse renewal date if provided — determines billingCycleDay and overrides nextBillingDate
  const renewalDateObj = data.renewalDate ? new Date(data.renewalDate) : null;
  const billingCycleDay = renewalDateObj ? renewalDateObj.getDate() : null;
  const nextBillingDate = renewalDateObj || periodEnd;

  // 5. Create business + subscription + modules + onboarding steps + main store in a transaction
  const result = await db.$transaction(async (tx) => {
    // Generate human-readable IDs inside the transaction for sequential assignment
    const bizCount = await tx.business.count();
    const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const businessCode = `BUS-${yyyymm}-${String(bizCount + 1).padStart(4, '0')}`;
    // Primary store of every business → STR-{businessCode}-001
    const storeCodeVal = `STR-${businessCode}-001`;

    // Create business — status is ONBOARDING (will be set to ACTIVE after deployment)
    const business = await tx.business.create({
      data: {
        businessCode,
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
          // Workflow permissions — set by Super Admin at provisioning.
          // STANDARD: locked to ECOMMERCE. PRO: admin-selected subset.
          enabledWorkflows: resolveEnabledWorkflows(plan.tier, data.businessType, data.enabledWorkflows),
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
        // New billing structure
        subscriptionAmount,
        discountAmount: discountAmount || null,
        finalAmount,
        implementationAmount,
        iosAppAmount,
        iosDiscountAmount,
        iosFinalAmount,
        iosSubscriptionCycle,
        addOns: addOnsJson,
        allowedStores: data.allowedStores ?? 1,
        billingCycle: billingCycle as 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'YEARLY',
        billingCycleDay: billingCycleDay,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        nextBillingDate: nextBillingDate,
        nextPaymentAmount: finalAmount,
        autoRenew: true,
        lastPaymentDate: now,
        lastPaymentAmount: finalAmount,
        notes: data.subscriptionNotes || data.overrideReason || null,
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
        storeCode: storeCodeVal,
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
    const storefrontBaseDomain = process.env.NEXT_PUBLIC_STOREFRONT_DOMAIN || 'quantixtechnology.in';
    await tx.domainMapping.create({
      data: {
        businessId: business.id,
        domain: data.domain || `${data.slug}.${storefrontBaseDomain}`,
        subdomain: data.subdomain || data.slug,
        isPrimary: true,
        status: 'PENDING_DNS',
      },
    });

    // Auto-provision: GST tax configs for the main store
    await tx.taxConfig.createMany({
      data: [
        { businessId: business.id, storeId: mainStore.id, name: 'GST 0% (Exempt)', taxType: 'GST_0', rate: 0, cgstRate: 0, sgstRate: 0, igstRate: 0, isDefault: true,  isActive: true },
        { businessId: business.id, storeId: mainStore.id, name: 'GST 5%',           taxType: 'GST_5', rate: 5, cgstRate: 2.5, sgstRate: 2.5, igstRate: 5, isDefault: false, isActive: true },
        { businessId: business.id, storeId: mainStore.id, name: 'GST 12%',          taxType: 'GST_12', rate: 12, cgstRate: 6, sgstRate: 6, igstRate: 12, isDefault: false, isActive: true },
        { businessId: business.id, storeId: mainStore.id, name: 'GST 18%',          taxType: 'GST_18', rate: 18, cgstRate: 9, sgstRate: 9, igstRate: 18, isDefault: false, isActive: true },
        { businessId: business.id, storeId: mainStore.id, name: 'GST 28%',          taxType: 'GST_28', rate: 28, cgstRate: 14, sgstRate: 14, igstRate: 28, isDefault: false, isActive: true },
      ],
    });

    // Auto-provision: default delivery zone (5 km radius) for the main store
    await tx.deliveryZone.create({
      data: {
        businessId: business.id,
        storeId:    mainStore.id,
        name:       'Default Delivery Zone',
        zoneType:   'CIRCLE',
        radius:     5.0,
        deliveryFee:    0,
        minOrderAmount: 0,
        estimatedTime:  30,
        isActive:       true,
      },
    });

    // Auto-provision: COD payment gateway (always on by default)
    await tx.paymentGateway.create({
      data: {
        businessId: business.id,
        name:       'Cash on Delivery',
        gateway:    'COD',
        isActive:   true,
        isTestMode: false,
        config:     JSON.stringify({ method: 'COD' }),
      },
    });

    // Auto-provision: BusinessBranding record
    await tx.businessBranding.create({
      data: {
        businessId:     business.id,
        primaryColor:   data.primaryColor   || '#10B981',
        secondaryColor: data.secondaryColor || null,
        logo:           data.logo           || null,
        darkMode:       false,
      },
    });

    // Auto-provision: AppConfig
    await tx.appConfig.create({
      data: {
        businessId:  business.id,
        appName:     data.name,
        tagline:     data.tagline || null,
        theme:       JSON.stringify({ primaryColor: data.primaryColor || '#10B981' }),
        contactInfo: JSON.stringify({
          email:   data.contactEmail || '',
          phone:   data.contactPhone || '',
          address: data.address      || '',
        }),
      },
    });

    // Auto-provision: default feature flags
    await tx.featureFlag.createMany({
      data: [
        { businessId: business.id, key: 'pos_enabled',            enabled: true,  value: '{}' },
        { businessId: business.id, key: 'delivery_enabled',       enabled: true,  value: '{}' },
        { businessId: business.id, key: 'online_orders_enabled',  enabled: true,  value: '{}' },
        { businessId: business.id, key: 'promo_codes_enabled',    enabled: true,  value: '{}' },
        { businessId: business.id, key: 'loyalty_enabled',        enabled: false, value: '{}' },
        { businessId: business.id, key: 'subscription_enabled',   enabled: false, value: '{}' },
      ],
    });

    // Auto-provision: default workflow rules (order lifecycle)
    await tx.workflowRule.createMany({
      data: [
        {
          businessId: business.id,
          storeId:    mainStore.id,
          ruleKey:    'notify_on_delivery',
          ruleName:   'Notify customer on delivery',
          trigger:    'ORDER_DELIVERED',
          conditions: '[]',
          actions:    JSON.stringify([{ type: 'SEND_NOTIFICATION', channel: 'PUSH' }]),
          isActive:   true,
          priority:   10,
        },
        {
          businessId: business.id,
          storeId:    mainStore.id,
          ruleKey:    'order_auto_confirm',
          ruleName:   'Auto-confirm new orders',
          trigger:    'ORDER_CREATED',
          conditions: '[]',
          actions:    JSON.stringify([{ type: 'SET_STATUS', value: 'CONFIRMED' }]),
          isActive:   false,
          priority:   10,
        },
      ],
    });

    // Update lead if provided — mark as CLOSED_WON and link the business
    if (data.leadId) {
      await tx.lead.update({
        where: { id: data.leadId },
        data: {
          stage: 'CLOSED_WON',
          convertedBusinessId: business.id,
          convertedAt: new Date(),
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
        loginId: ownerEmail,
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

    // Create primary store login user (STORE_MANAGER scoped to main store)
    const storeEmail = `store@${data.slug}.in`;
    const storeRawPassword = `Store@${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const storePasswordHash = await hashPassword(storeRawPassword);
    const storeUser = await tx.user.create({
      data: {
        email: storeEmail,
        loginId: storeEmail,
        name: `${data.name} - Main Store`,
        passwordHash: storePasswordHash,
        authProvider: 'PASSWORD',
        isActive: true,
      },
    });
    await tx.businessUser.create({
      data: {
        userId: storeUser.id,
        businessId: business.id,
        storeId: mainStore.id,
        role: 'STORE_MANAGER',
        isActive: true,
        invitedAt: new Date(),
        acceptedAt: new Date(),
      },
    });

    // Auto-create deployment records for all 4 app types (status=PENDING)
    await tx.deployment.createMany({
      data: [
        { businessId: business.id, type: 'CUSTOMER_APP',    status: 'PENDING', environment: 'production', hostingProvider: 'replit', hostingConfig: '{}', healthStatus: 'unknown' },
        { businessId: business.id, type: 'WEBSITE',         status: 'PENDING', environment: 'production', hostingProvider: 'replit', hostingConfig: '{}', healthStatus: 'unknown' },
        { businessId: business.id, type: 'DELIVERY_APP',    status: 'PENDING', environment: 'production', hostingProvider: 'replit', hostingConfig: '{}', healthStatus: 'unknown' },
        { businessId: business.id, type: 'ADMIN_APP',       status: 'PENDING', environment: 'production', hostingProvider: 'replit', hostingConfig: '{}', healthStatus: 'unknown' },
      ],
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
          subscriptionAmount,
          finalAmount,
          leadId: data.leadId,
          ownerEmail,
        }),
      },
    });

    return {
      business,
      mainStoreCode: mainStore.storeCode,
      mainStoreId: mainStore.id,
      ownerEmail,
      ownerPassword: rawPassword,
      ownerUserId: ownerUser.id,
      mainStoreCredentials: {
        email: storeEmail,
        password: storeRawPassword,
        userId: storeUser.id,
        loginId: storeEmail,
      },
    };
  });

  // Return the created business with relations plus owner credentials
  const business = await getBusiness(result.business.id);

  // Auto-provision mobile apps (fire-and-forget — never blocks business creation)
  void triggerMobileProvisioning({
    businessId: result.business.id,
    slug: data.slug,
    name: data.name,
    logo: data.logo,
    primaryColor: data.primaryColor,
    businessType: data.businessType,
    packageBase: `com.${data.slug.replace(/-/g, '')}`,
  });

  return {
    ...business,
    ownerCredentials: {
      email: result.ownerEmail,
      password: result.ownerPassword,
      userId: result.ownerUserId,
      loginId: result.ownerEmail,
    },
    mainStoreCode: result.mainStoreCode,
    mainStoreId: result.mainStoreId,
    mainStoreCredentials: result.mainStoreCredentials,
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
    'tagline', 'address', 'city', 'state', 'pincode', 'country', 'gstNumber', 'panNumber',
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

  // Handle owner name — stored on the CLIENT_OWNER user, not the Business.
  // (Owner display name only; no credentials/roles are touched.)
  if (data.ownerName !== undefined && data.ownerName !== null) {
    const ownerLink = await db.businessUser.findFirst({
      where: { businessId, role: 'CLIENT_OWNER', isActive: true },
      select: { userId: true },
    });
    if (ownerLink) {
      await db.user.update({
        where: { id: ownerLink.userId },
        data: { name: data.ownerName },
      });
    }
  }

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
  ONBOARDING: ['ACTIVE', 'TRIAL', 'SUSPENDED', 'CHURNED'],
  TRIAL: ['ACTIVE', 'SUSPENDED', 'EXPIRED'],
  ACTIVE: ['SUSPENDED', 'CHURNED'],
  SUSPENDED: ['ACTIVE', 'CHURNED'],
  EXPIRED: ['ACTIVE', 'CHURNED'],
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

  await db.business.update({
    where: { id: businessId },
    data: { isOnline },
  });

  return evaluateActivation(businessId);
}

// ============================================================================
// ACTIVATION CHECKLIST & AUTO-STATUS
// ============================================================================

/**
 * STATUS_ITEMS determine the business status (ACTIVE/ONBOARDING/INACTIVE).
 * Business status represents operational readiness only — no billing dependency.
 *   ACTIVE:     Online ON + Domain configured + SSL active
 *   ONBOARDING: Online ON but Domain or SSL missing
 *   INACTIVE:   Online OFF
 *
 * READINESS_ITEMS are informational only — they do NOT affect status.
 */
const STATUS_ITEMS = ['domain', 'ssl', 'online'] as const;
const READINESS_ITEMS = ['storeSettings', 'category', 'product', 'adminUser', 'logo', 'paymentGateway', 'deliveryConfig'] as const;
const ALL_ITEMS = [...STATUS_ITEMS, ...READINESS_ITEMS] as const;

type ActivationChecklist = Record<string, boolean>;

async function autoDetectChecklist(businessId: string): Promise<ActivationChecklist> {
  const biz = await db.business.findUnique({
    where: { id: businessId },
    include: {
      domain: true,
      businessSubscription: { select: { status: true } },
      businessUsers: { where: { role: 'CLIENT_OWNER', isActive: true }, take: 1, select: { id: true } },
      stores: { take: 1, select: { id: true, name: true, phone: true, email: true, address: true } },
      _count: { select: { categories: true, products: true } },
    },
  });
  if (!biz) throw new Error(`Business "${businessId}" not found`);

  const store = biz.stores[0];

  return {
    domain: !!biz.domain?.domain,
    ssl: biz.domain?.sslStatus?.toLowerCase() === 'active',
    online: biz.isOnline,
    storeSettings: !!(store && store.name),
    category: biz._count.categories > 0,
    product: biz._count.products > 0,
    adminUser: biz.businessUsers.length > 0,
    logo: !!biz.logo,
    paymentGateway: false, // manually toggleable by Super Admin
    deliveryConfig: false, // manually toggleable by Super Admin
  };
}

/**
 * Auto-detect checklist completion and compute activation status.
 *
 * Status rules (STATUS_ITEMS only — no billing dependency):
 *   Online ON  + Domain + SSL active  → ACTIVE
 *   Online ON  + Domain or SSL missing → ONBOARDING
 *   Online OFF                         → INACTIVE
 *
 * READINESS_ITEMS are stored but do NOT affect status.
 *
 * Manual overrides stored in activationChecklist JSON take precedence
 * over auto-detected values. Call toggleChecklistItem() to set overrides.
 */
export async function evaluateActivation(businessId: string) {
  const auto = await autoDetectChecklist(businessId);

  const biz = await db.business.findUnique({
    where: { id: businessId },
    select: { activationChecklist: true, isOnline: true, status: true },
  });
  if (!biz) throw new Error(`Business "${businessId}" not found`);

  const stored: ActivationChecklist = biz.activationChecklist
    ? (JSON.parse(biz.activationChecklist) as ActivationChecklist)
    : {};
  const merged: ActivationChecklist = {};
  for (const key of ALL_ITEMS) {
    merged[key] = key in stored ? stored[key] : (auto[key] ?? false);
  }

  const statusCompleted = STATUS_ITEMS.filter(k => merged[k]).length;
  const statusAllDone = statusCompleted === STATUS_ITEMS.length;
  const readinessCompleted = READINESS_ITEMS.filter(k => merged[k]).length;
  const readinessTotal = READINESS_ITEMS.length;

  let newStatus: string;
  if (merged['online']) {
    if (statusAllDone) {
      newStatus = 'ACTIVE';
    } else {
      newStatus = 'ONBOARDING';
    }
  } else {
    newStatus = 'INACTIVE';
  }

  const updateData: Record<string, unknown> = {
    activationChecklist: JSON.stringify(merged),
    activationProgress: readinessCompleted,
    activationCompleted: readinessCompleted === readinessTotal,
  };

  if (newStatus !== biz.status) {
    updateData.status = newStatus;
    if (newStatus === 'ACTIVE') {
      updateData.activatedAt = new Date();
      updateData.onboardedAt = new Date();
    }
  }

  return db.business.update({ where: { id: businessId }, data: updateData });
}

/**
 * Toggle a single activation checklist item.
 * Stores the override in activationChecklist JSON, then re-evaluates.
 */
export async function toggleChecklistItem(businessId: string, item: string, value: boolean) {
  const allKeys = ALL_ITEMS as readonly string[];
  if (!allKeys.includes(item)) {
    throw new Error(`Invalid checklist item "${item}". Must be one of: ${allKeys.join(', ')}`);
  }

  const biz = await db.business.findUnique({
    where: { id: businessId },
    select: { activationChecklist: true },
  });
  if (!biz) throw new Error(`Business "${businessId}" not found`);

  const checklist: ActivationChecklist = biz.activationChecklist
    ? (JSON.parse(biz.activationChecklist) as ActivationChecklist)
    : {};
  checklist[item] = value;

  await db.business.update({
    where: { id: businessId },
    data: { activationChecklist: JSON.stringify(checklist) },
  });

  return evaluateActivation(businessId);
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

  // Lead was already marked CLOSED_WON when the business was created — no further update needed
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
  planTier?: 'STANDARD' | 'PRO';
  billingCycle?: 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'YEARLY';
  subscriptionAmount?: number;
  discountAmount?: number;
  implementationAmount?: number;
  domain?: string;
  subdomain?: string;
  primaryColor?: string;
  secondaryColor?: string;
}): Promise<unknown> {
  const lead = await db.lead.findUnique({ where: { id: params.leadId } });
  if (!lead) {
    throw new Error(`Lead "${params.leadId}" not found`);
  }

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
    planTier: params.planTier,
    billingCycle: params.billingCycle || 'MONTHLY',
    subscriptionAmount: params.subscriptionAmount,
    discountAmount: params.discountAmount,
    implementationAmount: params.implementationAmount,
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
