// ============================================================================
// Car Wash OS Provisioning (v1.3.0)
// Provisions default Car Wash OS resources for new businesses
// ============================================================================

import { db } from '@/lib/db'

/**
 * Provision default Car Wash OS resources
 */
export async function provisionCarWashResources(businessId: string) {
  // Provision service packages
  await provisionServicePackages(businessId)

  // Provision queue defaults
  await provisionQueueDefaults(businessId)

  // Provision booking settings
  await provisionBookingSettings(businessId)
}

/**
 * Provision default service packages for Car Wash
 */
async function provisionServicePackages(businessId: string) {
  const business = await db.business.findUnique({
    where: { id: businessId },
  })

  if (!business) {
    return
  }

  const currentSettings = JSON.parse(business.settings || '{}')
  const defaultPackages = [
    {
      name: 'Basic Wash',
      code: 'BASIC',
      price: 200,
      duration: 15,
      description: 'External wash with high pressure jet',
    },
    {
      name: 'Standard Wash',
      code: 'STANDARD',
      price: 350,
      duration: 25,
      description: 'External wash, interior vacuum, window clean',
    },
    {
      name: 'Premium Wash',
      code: 'PREMIUM',
      price: 550,
      duration: 40,
      description: 'Full exterior and interior detail with polishing',
    },
    {
      name: 'Express Wash',
      code: 'EXPRESS',
      price: 150,
      duration: 10,
      description: 'Quick external wash',
    },
    {
      name: 'Deep Clean',
      code: 'DEEP',
      price: 800,
      duration: 60,
      description: 'Complete detailing and deep cleaning',
    },
  ]

  const existingPackages = currentSettings.servicePackages || []
  if (existingPackages.length === 0) {
    await db.business.update({
      where: { id: businessId },
      data: {
        settings: JSON.stringify({
          ...currentSettings,
          servicePackages: defaultPackages,
        }),
      },
    })
  }
}

/**
 * Provision queue defaults for Car Wash
 */
async function provisionQueueDefaults(businessId: string) {
  const business = await db.business.findUnique({
    where: { id: businessId },
  })

  if (!business) {
    return
  }

  const currentSettings = JSON.parse(business.settings || '{}')
  const queueDefaults = {
    maxQueueSize: 20,
    averageServiceTime: 25, // minutes
    simultaneousSlots: 3, // number of bays
    enablePriority: true,
    priorityFee: 50,
    estimatedWaitTime: 30, // minutes
    slots: [
      { bayNumber: 1, available: true },
      { bayNumber: 2, available: true },
      { bayNumber: 3, available: true },
    ],
  }

  const updatedSettings = {
    ...currentSettings,
    queue: queueDefaults,
  }

  await db.business.update({
    where: { id: businessId },
    data: {
      settings: JSON.stringify(updatedSettings),
    },
  })
}

/**
 * Provision booking settings for Car Wash
 */
async function provisionBookingSettings(businessId: string) {
  const business = await db.business.findUnique({
    where: { id: businessId },
  })

  if (!business) {
    return
  }

  const currentSettings = JSON.parse(business.settings || '{}')
  const bookingSettings = {
    enabled: true,
    advanceBookingDays: 7,
    minBookingHours: 1,
    maxBookingHours: 168, // 1 week
    timeSlotDuration: 15, // minutes
    operatingHours: {
      startTime: '08:00',
      endTime: '20:00',
      daysOpen: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      closed: [],
    },
    cancellationPolicy: {
      allowCancellation: true,
      cancellationWindow: 2, // hours before appointment
      cancellationFee: 0,
    },
    notifications: {
      sendConfirmation: true,
      sendReminder: true,
      reminderTime: 2, // hours before appointment
    },
  }

  const updatedSettings = {
    ...currentSettings,
    booking: bookingSettings,
  }

  await db.business.update({
    where: { id: businessId },
    data: {
      settings: JSON.stringify(updatedSettings),
    },
  })
}
