// ============================================================================
// Product Initialization
// Initialize complete product profiles with plans, settings, apps, templates
// ============================================================================

import {
  createProductPlan,
  setProductWebsiteTemplate,
  setProductMobileApp,
  setProductDefaultSettings,
} from '@/lib/product-management'

// ============================================================================
// COMMERCE OS INITIALIZATION
// ============================================================================

export async function initializeCommerceOS() {
  // Create subscription plans
  await createProductPlan({
    productCode: 'COMMERCE',
    code: 'STARTER',
    name: 'Starter Plan',
    description: 'Perfect for new online stores',
    includedFeatures: [
      'PRODUCTS',
      'INVENTORY',
      'ORDERS',
      'CUSTOMERS',
      'DELIVERY',
      'PAYMENTS',
    ],
    storageQuotaMB: 10737418, // 10GB
    userLimit: 5,
    branchLimit: 1,
    pricing: {
      currency: 'INR',
      amount: 2999,
      interval: 'monthly',
    },
    isDefault: true,
  })

  await createProductPlan({
    productCode: 'COMMERCE',
    code: 'PROFESSIONAL',
    name: 'Professional Plan',
    description: 'For growing online businesses',
    includedFeatures: [
      'PRODUCTS',
      'INVENTORY',
      'ORDERS',
      'CUSTOMERS',
      'DELIVERY',
      'PAYMENTS',
      'POS',
      'COUPONS',
      'MARKETING',
    ],
    storageQuotaMB: 52428800, // 50GB
    userLimit: 25,
    branchLimit: 5,
    pricing: {
      currency: 'INR',
      amount: 7999,
      interval: 'monthly',
    },
  })

  await createProductPlan({
    productCode: 'COMMERCE',
    code: 'ENTERPRISE',
    name: 'Enterprise Plan',
    description: 'For large-scale retail operations',
    includedFeatures: [
      'PRODUCTS',
      'INVENTORY',
      'ORDERS',
      'CUSTOMERS',
      'DELIVERY',
      'PAYMENTS',
      'POS',
      'COUPONS',
      'MARKETING',
      'LOYALTY',
      'WHOLESALE',
      'ERP',
    ],
    storageQuotaMB: 262144000, // 250GB
    userLimit: 100,
    branchLimit: 50,
    pricing: {
      currency: 'INR',
      amount: 19999,
      interval: 'monthly',
    },
  })

  // Set website template
  await setProductWebsiteTemplate({
    productCode: 'COMMERCE',
    name: 'Store Website',
    description: 'E-commerce store website template',
    includedPages: [
      'HOME',
      'PRODUCTS',
      'CATEGORIES',
      'CART',
      'CHECKOUT',
      'ORDERS',
      'PROFILE',
      'ABOUT',
      'CONTACT',
      'BLOG',
    ],
  })

  // Set mobile apps
  await setProductMobileApp({
    productCode: 'COMMERCE',
    appType: 'CUSTOMER',
    name: 'Commerce Customer App',
    description: 'Customer shopping and order tracking',
    currentVersion: '2.1.0',
  })

  await setProductMobileApp({
    productCode: 'COMMERCE',
    appType: 'DELIVERY',
    name: 'Commerce Delivery App',
    description: 'Delivery partner app for order fulfillment',
    currentVersion: '2.1.0',
  })

  await setProductMobileApp({
    productCode: 'COMMERCE',
    appType: 'ADMIN',
    name: 'Commerce Admin App',
    description: 'Business owner and staff management',
    currentVersion: '2.1.0',
  })

  // Set default settings
  await setProductDefaultSettings({
    productCode: 'COMMERCE',
    defaultCurrency: 'INR',
    defaultTimezone: 'Asia/Kolkata',
    defaultLanguage: 'en',
    orderPrefix: 'ORD',
    invoicePrefix: 'INV',
    notificationDefaults: {
      email: true,
      sms: true,
      whatsapp: false,
      pushNotifications: true,
    },
    brandingDefaults: {
      primaryColor: '#10B981',
      secondaryColor: '#EC4899',
      fontFamily: 'Inter',
    },
    featureDefaults: {
      autoConfirmOrders: false,
      instantRefunds: false,
      customerReviews: true,
    },
  })
}

// ============================================================================
// LAUNDRY OS INITIALIZATION
// ============================================================================

export async function initializeLaundryOS() {
  // Create subscription plans
  await createProductPlan({
    productCode: 'LAUNDRY',
    code: 'STARTER',
    name: 'Starter Plan',
    description: 'Perfect for small laundry businesses',
    includedFeatures: [
      'ORDERS',
      'PICKUP_DELIVERY',
      'STORE_AUDIT',
      'PROCESSING',
      'BATCH_QUEUE',
      'QC_SYSTEM',
      'CUSTOMERS',
    ],
    storageQuotaMB: 10737418, // 10GB
    userLimit: 5,
    branchLimit: 1,
    pricing: {
      currency: 'INR',
      amount: 2499,
      interval: 'monthly',
    },
    isDefault: true,
  })

  await createProductPlan({
    productCode: 'LAUNDRY',
    code: 'PROFESSIONAL',
    name: 'Professional Plan',
    description: 'For growing laundry franchises',
    includedFeatures: [
      'ORDERS',
      'PICKUP_DELIVERY',
      'STORE_AUDIT',
      'PROCESSING',
      'BATCH_QUEUE',
      'QC_SYSTEM',
      'CUSTOMERS',
      'CRM',
      'MARKETING',
      'SUBSCRIPTIONS',
    ],
    storageQuotaMB: 31457280, // 30GB
    userLimit: 20,
    branchLimit: 3,
    pricing: {
      currency: 'INR',
      amount: 6999,
      interval: 'monthly',
    },
  })

  await createProductPlan({
    productCode: 'LAUNDRY',
    code: 'ENTERPRISE',
    name: 'Enterprise Plan',
    description: 'For large laundry networks',
    includedFeatures: [
      'ORDERS',
      'PICKUP_DELIVERY',
      'STORE_AUDIT',
      'PROCESSING',
      'BATCH_QUEUE',
      'QC_SYSTEM',
      'CUSTOMERS',
      'CRM',
      'MARKETING',
      'SUBSCRIPTIONS',
      'MULTI_STORE',
      'MULTI_PROCESSING',
      'WHATSAPP',
    ],
    storageQuotaMB: 104857600, // 100GB
    userLimit: 100,
    branchLimit: 50,
    pricing: {
      currency: 'INR',
      amount: 15999,
      interval: 'monthly',
    },
  })

  // Set website template
  await setProductWebsiteTemplate({
    productCode: 'LAUNDRY',
    name: 'Laundry Website',
    description: 'Laundry service website template',
    includedPages: [
      'HOME',
      'SERVICES',
      'PRICING',
      'LOCATIONS',
      'BOOKING',
      'ORDERS',
      'PROFILE',
      'FAQ',
      'CONTACT',
    ],
  })

  // Set mobile apps
  await setProductMobileApp({
    productCode: 'LAUNDRY',
    appType: 'CUSTOMER',
    name: 'Laundry Customer App',
    description: 'Customer order and delivery tracking',
    currentVersion: '1.3.0',
  })

  await setProductMobileApp({
    productCode: 'LAUNDRY',
    appType: 'DELIVERY',
    name: 'Laundry Delivery App',
    description: 'Pickup and delivery driver app',
    currentVersion: '1.3.0',
  })

  await setProductMobileApp({
    productCode: 'LAUNDRY',
    appType: 'ADMIN',
    name: 'Laundry Admin App',
    description: 'Business owner and staff management',
    currentVersion: '1.3.0',
  })

  // Set default settings
  await setProductDefaultSettings({
    productCode: 'LAUNDRY',
    defaultCurrency: 'INR',
    defaultTimezone: 'Asia/Kolkata',
    defaultLanguage: 'en',
    orderPrefix: 'LAU',
    invoicePrefix: 'LINV',
    notificationDefaults: {
      email: true,
      sms: true,
      whatsapp: true,
      pushNotifications: true,
    },
    brandingDefaults: {
      primaryColor: '#3B82F6',
      secondaryColor: '#8B5CF6',
      fontFamily: 'Inter',
    },
    featureDefaults: {
      autoAssignProcessingCenter: true,
      qualityCheckRequired: true,
      subscriptionPlansEnabled: true,
    },
  })
}

// ============================================================================
// CAR WASH OS INITIALIZATION
// ============================================================================

export async function initializeCarWashOS() {
  // Create subscription plans (placeholder)
  await createProductPlan({
    productCode: 'CARWASH',
    code: 'STARTER',
    name: 'Starter Plan',
    description: 'For single location car wash',
    includedFeatures: ['SERVICES', 'SCHEDULING', 'QUEUE', 'CUSTOMERS'],
    storageQuotaMB: 10737418, // 10GB
    userLimit: 3,
    branchLimit: 1,
    pricing: {
      currency: 'INR',
      amount: 1999,
      interval: 'monthly',
    },
    isDefault: true,
  })

  await createProductPlan({
    productCode: 'CARWASH',
    code: 'PROFESSIONAL',
    name: 'Professional Plan',
    description: 'For multi-location car wash chains',
    includedFeatures: ['SERVICES', 'SCHEDULING', 'QUEUE', 'CUSTOMERS'],
    storageQuotaMB: 41943040, // 40GB
    userLimit: 15,
    branchLimit: 10,
    pricing: {
      currency: 'INR',
      amount: 5999,
      interval: 'monthly',
    },
  })

  await createProductPlan({
    productCode: 'CARWASH',
    code: 'ENTERPRISE',
    name: 'Enterprise Plan',
    description: 'For large car wash networks',
    includedFeatures: ['SERVICES', 'SCHEDULING', 'QUEUE', 'CUSTOMERS'],
    storageQuotaMB: 104857600, // 100GB
    userLimit: 50,
    branchLimit: 100,
    pricing: {
      currency: 'INR',
      amount: 14999,
      interval: 'monthly',
    },
  })

  // Set website template
  await setProductWebsiteTemplate({
    productCode: 'CARWASH',
    name: 'Car Wash Booking Website',
    description: 'Car wash service booking template',
    includedPages: ['HOME', 'SERVICES', 'BOOKING', 'LOCATIONS', 'PROFILE', 'CONTACT'],
  })

  // Set mobile apps
  await setProductMobileApp({
    productCode: 'CARWASH',
    appType: 'CUSTOMER',
    name: 'Car Wash Customer App',
    description: 'Customer booking and tracking',
    currentVersion: '1.0.0',
  })

  // Set default settings
  await setProductDefaultSettings({
    productCode: 'CARWASH',
    defaultCurrency: 'INR',
    defaultTimezone: 'Asia/Kolkata',
    defaultLanguage: 'en',
    orderPrefix: 'CAR',
    invoicePrefix: 'CINV',
    notificationDefaults: {
      email: true,
      sms: true,
      whatsapp: false,
      pushNotifications: true,
    },
    brandingDefaults: {
      primaryColor: '#EF4444',
      secondaryColor: '#F97316',
      fontFamily: 'Inter',
    },
  })
}

// ============================================================================
// BATCH INITIALIZATION
// ============================================================================

/**
 * Initialize all products with their complete profiles
 * Idempotent — safe to call multiple times
 */
export async function initializeAllProducts() {
  await Promise.all([
    initializeCommerceOS(),
    initializeLaundryOS(),
    initializeCarWashOS(),
  ])
}
