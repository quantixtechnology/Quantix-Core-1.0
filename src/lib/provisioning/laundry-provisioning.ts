// ============================================================================
// Laundry OS Provisioning (v1.3.0)
// Provisions default Laundry OS resources for new businesses
// ============================================================================

import { db } from '@/lib/db'

/**
 * Provision default Laundry OS resources
 */
export async function provisionLaundryResources(businessId: string) {
  // Provision laundry services
  await provisionLaundryServices(businessId)

  // Provision processing centers
  await provisionProcessingCenters(businessId)

  // Provision store audit configuration
  await provisionStoreAuditConfig(businessId)

  // Provision QC configuration
  await provisionQCConfig(businessId)

  // Provision pickup configuration
  await provisionPickupConfig(businessId)
}

/**
 * Provision default laundry services
 */
async function provisionLaundryServices(businessId: string) {
  const defaultServices = [
    { name: 'Regular Wash', code: 'REGULAR', price: 150, turnaroundDays: 3 },
    { name: 'Express Wash', code: 'EXPRESS', price: 200, turnaroundDays: 1 },
    { name: 'Premium Wash', code: 'PREMIUM', price: 300, turnaroundDays: 1 },
    { name: 'Dry Clean', code: 'DRYC', price: 350, turnaroundDays: 2 },
    { name: 'Ironing Only', code: 'IRON', price: 75, turnaroundDays: 1 },
  ]

  for (const service of defaultServices) {
    const existing = await db.businessUser.findFirst({
      where: {
        businessId,
        email: `service.${service.code.toLowerCase()}@internal`,
      },
    })

    if (!existing) {
      // Store service config in business settings
      const business = await db.business.findUnique({
        where: { id: businessId },
      })

      if (business) {
        const currentSettings = JSON.parse(business.settings || '{}')
        const services = currentSettings.laundryServices || []
        services.push(service)

        await db.business.update({
          where: { id: businessId },
          data: {
            settings: JSON.stringify({
              ...currentSettings,
              laundryServices: services,
            }),
          },
        })
      }
    }
  }
}

/**
 * Provision default processing centers
 */
async function provisionProcessingCenters(businessId: string) {
  const business = await db.business.findUnique({
    where: { id: businessId },
  })

  if (!business) {
    return
  }

  const currentSettings = JSON.parse(business.settings || '{}')
  const defaultCenter = {
    name: 'Main Processing Center',
    location: business.address || 'To be configured',
    capacity: 1000,
    workingHours: '08:00-20:00',
    machines: [],
  }

  const processingCenters = currentSettings.processingCenters || []
  const exists = processingCenters.some((c: any) => c.name === defaultCenter.name)

  if (!exists) {
    processingCenters.push(defaultCenter)
    await db.business.update({
      where: { id: businessId },
      data: {
        settings: JSON.stringify({
          ...currentSettings,
          processingCenters,
        }),
      },
    })
  }
}

/**
 * Provision store audit configuration
 */
async function provisionStoreAuditConfig(businessId: string) {
  const business = await db.business.findUnique({
    where: { id: businessId },
  })

  if (!business) {
    return
  }

  const currentSettings = JSON.parse(business.settings || '{}')
  const auditConfig = {
    enabled: true,
    frequency: 'DAILY',
    auditItems: [
      { name: 'Store Cleanliness', code: 'CLEAN' },
      { name: 'Staff Uniform', code: 'UNIFORM' },
      { name: 'Customer Service', code: 'SERVICE' },
      { name: 'Pricing Display', code: 'PRICING' },
      { name: 'Receipt Printer', code: 'RECEIPT' },
    ],
  }

  const updatedSettings = {
    ...currentSettings,
    storeAudit: auditConfig,
  }

  await db.business.update({
    where: { id: businessId },
    data: {
      settings: JSON.stringify(updatedSettings),
    },
  })
}

/**
 * Provision QC configuration
 */
async function provisionQCConfig(businessId: string) {
  const business = await db.business.findUnique({
    where: { id: businessId },
  })

  if (!business) {
    return
  }

  const currentSettings = JSON.parse(business.settings || '{}')
  const qcConfig = {
    enabled: true,
    photoRequired: true,
    qualityChecks: [
      { name: 'Color Check', code: 'COLOR' },
      { name: 'Stain Removal', code: 'STAIN' },
      { name: 'Fabric Condition', code: 'FABRIC' },
      { name: 'Threading Quality', code: 'THREAD' },
      { name: 'Button/Zipper Check', code: 'BUTTON' },
    ],
    sampleSize: 10, // percentage of items to QC
  }

  const updatedSettings = {
    ...currentSettings,
    qualityControl: qcConfig,
  }

  await db.business.update({
    where: { id: businessId },
    data: {
      settings: JSON.stringify(updatedSettings),
    },
  })
}

/**
 * Provision pickup configuration
 */
async function provisionPickupConfig(businessId: string) {
  const business = await db.business.findUnique({
    where: { id: businessId },
  })

  if (!business) {
    return
  }

  const currentSettings = JSON.parse(business.settings || '{}')
  const pickupConfig = {
    enabled: true,
    pickupZones: [
      {
        name: 'Zone A',
        location: business.address || 'Main Area',
        radius: 5,
      },
      {
        name: 'Zone B',
        location: business.address || 'Extended Area',
        radius: 10,
      },
    ],
    scheduleWindowMinutes: 120,
    scheduleDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  }

  const updatedSettings = {
    ...currentSettings,
    pickup: pickupConfig,
  }

  await db.business.update({
    where: { id: businessId },
    data: {
      settings: JSON.stringify(updatedSettings),
    },
  })
}
