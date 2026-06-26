// ============================================================================
// Product Management Utilities
// Functions for managing Product Plans, Website Templates, Apps, Settings
// ============================================================================

import { db } from '@/lib/db'

export interface ProductPlanConfig {
  productCode: string
  code: string
  name: string
  description?: string
  includedFeatures: string[]
  storageQuotaMB: number
  userLimit: number
  branchLimit: number
  pricing?: {
    currency: string
    amount: number
    interval: 'monthly' | 'yearly'
  }
  isDefault?: boolean
}

export interface ProductWebsiteTemplateConfig {
  productCode: string
  name: string
  description?: string
  defaultTheme?: {
    primaryColor?: string
    secondaryColor?: string
    fontFamily?: string
  }
  includedPages: string[]
}

export interface ProductMobileAppConfig {
  productCode: string
  appType: 'CUSTOMER' | 'DELIVERY' | 'ADMIN'
  name: string
  description?: string
  currentVersion?: string
}

export interface ProductDefaultSettingsConfig {
  productCode: string
  defaultCurrency?: string
  defaultTimezone?: string
  defaultLanguage?: string
  orderPrefix?: string
  invoicePrefix?: string
  notificationDefaults?: Record<string, unknown>
  brandingDefaults?: Record<string, unknown>
  featureDefaults?: Record<string, unknown>
}

// ============================================================================
// PRODUCT PLAN MANAGEMENT
// ============================================================================

/**
 * Create or update a subscription plan for a product
 */
export async function createProductPlan(config: ProductPlanConfig) {
  return db.productPlan.upsert({
    where: {
      productCode_code: {
        productCode: config.productCode,
        code: config.code,
      },
    },
    update: {
      name: config.name,
      description: config.description,
      includedFeatures: JSON.stringify(config.includedFeatures),
      storageQuotaMB: config.storageQuotaMB,
      userLimit: config.userLimit,
      branchLimit: config.branchLimit,
      pricing: JSON.stringify(config.pricing || {}),
      isDefault: config.isDefault ?? false,
    },
    create: {
      productCode: config.productCode,
      code: config.code,
      name: config.name,
      description: config.description,
      includedFeatures: JSON.stringify(config.includedFeatures),
      storageQuotaMB: config.storageQuotaMB,
      userLimit: config.userLimit,
      branchLimit: config.branchLimit,
      pricing: JSON.stringify(config.pricing || {}),
      isDefault: config.isDefault ?? false,
    },
  })
}

/**
 * Get all plans for a product
 */
export async function getProductPlans(productCode: string) {
  const plans = await db.productPlan.findMany({
    where: { productCode },
    orderBy: { code: 'asc' },
  })

  return plans.map((p) => ({
    ...p,
    includedFeatures: JSON.parse(p.includedFeatures) as string[],
    pricing: JSON.parse(p.pricing) as Record<string, unknown>,
  }))
}

/**
 * Get a specific plan
 */
export async function getProductPlan(productCode: string, planCode: string) {
  const plan = await db.productPlan.findUnique({
    where: {
      productCode_code: {
        productCode,
        code: planCode,
      },
    },
  })

  if (!plan) return null

  return {
    ...plan,
    includedFeatures: JSON.parse(plan.includedFeatures) as string[],
    pricing: JSON.parse(plan.pricing) as Record<string, unknown>,
  }
}

// ============================================================================
// PRODUCT WEBSITE TEMPLATE MANAGEMENT
// ============================================================================

/**
 * Create or update website template for a product
 */
export async function setProductWebsiteTemplate(config: ProductWebsiteTemplateConfig) {
  return db.productWebsiteTemplate.upsert({
    where: { productCode: config.productCode },
    update: {
      name: config.name,
      description: config.description,
      defaultTheme: JSON.stringify(config.defaultTheme || {}),
      includedPages: JSON.stringify(config.includedPages),
    },
    create: {
      productCode: config.productCode,
      name: config.name,
      description: config.description,
      defaultTheme: JSON.stringify(config.defaultTheme || {}),
      includedPages: JSON.stringify(config.includedPages),
    },
  })
}

/**
 * Get website template for a product
 */
export async function getProductWebsiteTemplate(productCode: string) {
  const template = await db.productWebsiteTemplate.findUnique({
    where: { productCode },
  })

  if (!template) return null

  return {
    ...template,
    defaultTheme: JSON.parse(template.defaultTheme) as Record<string, unknown>,
    includedPages: JSON.parse(template.includedPages) as string[],
  }
}

// ============================================================================
// PRODUCT MOBILE APP MANAGEMENT
// ============================================================================

/**
 * Create or update mobile app configuration
 */
export async function setProductMobileApp(config: ProductMobileAppConfig) {
  return db.productMobileApp.upsert({
    where: {
      productCode_appType: {
        productCode: config.productCode,
        appType: config.appType,
      },
    },
    update: {
      name: config.name,
      description: config.description,
      currentVersion: config.currentVersion,
    },
    create: {
      productCode: config.productCode,
      appType: config.appType,
      name: config.name,
      description: config.description,
      currentVersion: config.currentVersion,
    },
  })
}

/**
 * Get all mobile apps for a product
 */
export async function getProductMobileApps(productCode: string) {
  return db.productMobileApp.findMany({
    where: { productCode },
    orderBy: { appType: 'asc' },
  })
}

/**
 * Get a specific mobile app
 */
export async function getProductMobileApp(
  productCode: string,
  appType: 'CUSTOMER' | 'DELIVERY' | 'ADMIN'
) {
  return db.productMobileApp.findUnique({
    where: {
      productCode_appType: {
        productCode,
        appType,
      },
    },
  })
}

// ============================================================================
// PRODUCT DEFAULT SETTINGS MANAGEMENT
// ============================================================================

/**
 * Create or update default settings for a product
 */
export async function setProductDefaultSettings(config: ProductDefaultSettingsConfig) {
  return db.productDefaultSettings.upsert({
    where: { productCode: config.productCode },
    update: {
      defaultCurrency: config.defaultCurrency,
      defaultTimezone: config.defaultTimezone,
      defaultLanguage: config.defaultLanguage,
      orderPrefix: config.orderPrefix,
      invoicePrefix: config.invoicePrefix,
      notificationDefaults: JSON.stringify(config.notificationDefaults || {}),
      brandingDefaults: JSON.stringify(config.brandingDefaults || {}),
      featureDefaults: JSON.stringify(config.featureDefaults || {}),
    },
    create: {
      productCode: config.productCode,
      defaultCurrency: config.defaultCurrency,
      defaultTimezone: config.defaultTimezone,
      defaultLanguage: config.defaultLanguage,
      orderPrefix: config.orderPrefix,
      invoicePrefix: config.invoicePrefix,
      notificationDefaults: JSON.stringify(config.notificationDefaults || {}),
      brandingDefaults: JSON.stringify(config.brandingDefaults || {}),
      featureDefaults: JSON.stringify(config.featureDefaults || {}),
    },
  })
}

/**
 * Get default settings for a product
 */
export async function getProductDefaultSettings(productCode: string) {
  const settings = await db.productDefaultSettings.findUnique({
    where: { productCode },
  })

  if (!settings) return null

  return {
    ...settings,
    notificationDefaults: JSON.parse(settings.notificationDefaults) as Record<string, unknown>,
    brandingDefaults: JSON.parse(settings.brandingDefaults) as Record<string, unknown>,
    featureDefaults: JSON.parse(settings.featureDefaults) as Record<string, unknown>,
  }
}

// ============================================================================
// COMPLETE PRODUCT PROFILE
// ============================================================================

/**
 * Get complete product profile including all management data
 */
export async function getCompleteProductProfile(productCode: string) {
  const product = await db.platformProduct.findUnique({
    where: { code: productCode },
  })

  if (!product) return null

  const [plans, websiteTemplate, mobileApps, defaultSettings] = await Promise.all([
    getProductPlans(productCode),
    getProductWebsiteTemplate(productCode),
    getProductMobileApps(productCode),
    getProductDefaultSettings(productCode),
  ])

  try {
    const metadata = JSON.parse(product.metadata)
    return {
      id: product.id,
      code: product.code,
      name: product.name,
      slug: product.slug,
      description: product.description,
      workspaceUrl: product.workspaceUrl,
      currentVersion: product.currentVersion,
      status: product.status,
      isEnabled: product.isEnabled,
      defaultStorageQuotaMB: product.defaultStorageQuotaMB,
      catalog: metadata.catalog || null,
      plans,
      websiteTemplate,
      mobileApps,
      defaultSettings,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    }
  } catch {
    return {
      id: product.id,
      code: product.code,
      name: product.name,
      slug: product.slug,
      description: product.description,
      workspaceUrl: product.workspaceUrl,
      currentVersion: product.currentVersion,
      status: product.status,
      isEnabled: product.isEnabled,
      defaultStorageQuotaMB: product.defaultStorageQuotaMB,
      catalog: null,
      plans,
      websiteTemplate,
      mobileApps,
      defaultSettings,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    }
  }
}
