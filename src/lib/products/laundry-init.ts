// ============================================================================
// Laundry OS Initialization
// Registers Laundry provisioner and product runtime configuration
// ============================================================================

import { ProductProvisionerRegistry } from '@/lib/product-provisioner-registry'
import { laundryProvisioner } from './laundry-provisioner'
import { db } from '@/lib/db'

/**
 * Initialize Laundry OS
 * Called on application startup
 * Registers provisioner and updates product runtime configuration
 */
export async function initializeLaundryProduct(): Promise<void> {
  try {
    // Register Laundry provisioner
    ProductProvisionerRegistry.register('LAUNDRY', laundryProvisioner)

    // Update product runtime configuration for LOCAL_MODULE deployment
    await db.platformProduct.update({
      where: { code: 'LAUNDRY' },
      data: {
        deploymentMode: 'LOCAL_MODULE',
        deploymentStatus: 'READY',
        apiBaseUrl: null, // Local, no external API needed
        healthCheckUrl: '/api/products/laundry/health',
        provisionerName: 'LaundryProvisioner',
        lastDeploymentAt: new Date(),
      },
    })

    console.log('[LAUNDRY] Product initialized and registered')
  } catch (error) {
    // Provisioner already registered or product not found is OK
    if (
      error instanceof Error &&
      (error.message.includes('already registered') || error.message.includes('not found'))
    ) {
      return
    }
    console.error('[LAUNDRY] Initialization error:', error)
  }
}
