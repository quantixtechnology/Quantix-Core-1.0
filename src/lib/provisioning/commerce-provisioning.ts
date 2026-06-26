// ============================================================================
// Commerce OS Provisioning (v1.3.0)
// Provisions default Commerce OS resources for new businesses
// ============================================================================

import { db } from '@/lib/db'

/**
 * Provision default Commerce OS resources
 */
export async function provisionCommerceResources(businessId: string) {
  // Provision default categories
  await provisionDefaultCategories(businessId)

  // Provision inventory defaults
  await provisionInventoryDefaults(businessId)

  // Provision tax settings
  await provisionTaxSettings(businessId)

  // Provision POS defaults
  await provisionPOSDefaults(businessId)

  // Provision delivery defaults
  await provisionDeliveryDefaults(businessId)
}

/**
 * Create default product categories for Commerce
 */
async function provisionDefaultCategories(businessId: string) {
  const defaultCategories = [
    { name: 'Electronics', description: 'Electronic products and devices', sortOrder: 1 },
    { name: 'Clothing', description: 'Apparel and fashion items', sortOrder: 2 },
    { name: 'Home & Garden', description: 'Home and garden products', sortOrder: 3 },
    { name: 'Sports & Outdoors', description: 'Sports and outdoor equipment', sortOrder: 4 },
    { name: 'Books & Media', description: 'Books, music, and media', sortOrder: 5 },
  ]

  for (const cat of defaultCategories) {
    const existing = await db.category.findFirst({
      where: {
        businessId,
        name: cat.name,
      },
    })

    if (!existing) {
      await db.category.create({
        data: {
          businessId,
          name: cat.name,
          description: cat.description,
          slug: cat.name.toLowerCase().replace(/\s+/g, '-'),
          status: 'ACTIVE',
          sortOrder: cat.sortOrder,
        },
      })
    }
  }
}

/**
 * Provision inventory defaults for Commerce
 */
async function provisionInventoryDefaults(businessId: string) {
  const business = await db.business.findUnique({
    where: { id: businessId },
  })

  if (!business) {
    return
  }

  // Update business settings with inventory defaults
  const currentSettings = JSON.parse(business.settings || '{}')
  const inventoryDefaults = {
    lowStockThreshold: 10,
    trackInventory: true,
    allowNegativeStock: false,
    autoReorderEnabled: false,
    warehouseLocation: 'Main Store',
  }

  const updatedSettings = {
    ...currentSettings,
    inventory: inventoryDefaults,
  }

  await db.business.update({
    where: { id: businessId },
    data: {
      settings: JSON.stringify(updatedSettings),
    },
  })
}

/**
 * Provision tax settings for Commerce
 */
async function provisionTaxSettings(businessId: string) {
  const business = await db.business.findUnique({
    where: { id: businessId },
  })

  if (!business) {
    return
  }

  // Check if tax config already exists
  const existing = await db.taxConfig.findFirst({
    where: { businessId },
  })

  if (existing) {
    return
  }

  // Create default tax config for India
  await db.taxConfig.create({
    data: {
      businessId,
      taxName: 'GST',
      taxRate: 18,
      applicableOn: 'PRODUCTS',
      isActive: true,
      notes: 'Standard GST rate for Commerce OS',
    },
  })
}

/**
 * Provision POS defaults for Commerce
 */
async function provisionPOSDefaults(businessId: string) {
  const business = await db.business.findUnique({
    where: { id: businessId },
  })

  if (!business) {
    return
  }

  const currentSettings = JSON.parse(business.settings || '{}')
  const posDefaults = {
    receiptFormat: 'THERMAL',
    printLogoOnReceipt: true,
    includeTaxInPrice: true,
    discountAllowed: true,
    maxDiscount: 50,
    requirePassword: false,
  }

  const updatedSettings = {
    ...currentSettings,
    pos: posDefaults,
  }

  await db.business.update({
    where: { id: businessId },
    data: {
      settings: JSON.stringify(updatedSettings),
    },
  })
}

/**
 * Provision delivery defaults for Commerce
 */
async function provisionDeliveryDefaults(businessId: string) {
  const business = await db.business.findUnique({
    where: { id: businessId },
  })

  if (!business) {
    return
  }

  const currentSettings = JSON.parse(business.settings || '{}')
  const deliveryDefaults = {
    deliveryEnabled: true,
    deliveryCharge: 0,
    freeDeliveryAbove: 500,
    maxDeliveryDistance: 10,
    deliveryTimeSlots: ['09:00-12:00', '12:00-15:00', '15:00-18:00', '18:00-21:00'],
  }

  const updatedSettings = {
    ...currentSettings,
    delivery: deliveryDefaults,
  }

  await db.business.update({
    where: { id: businessId },
    data: {
      settings: JSON.stringify(updatedSettings),
    },
  })
}
