// ============================================================================
// Commerce OS Initialization
// Registers Commerce provisioner and product runtime configuration
// ============================================================================

import { ProductProvisionerRegistry } from '@/lib/product-provisioner-registry'
import { commerceProvisioner } from './commerce-provisioner'
import { db } from '@/lib/db'

/**
 * Initialize Commerce OS
 * Called on application startup
 * Registers provisioner and updates product runtime configuration
 */
export async function initializeCommerceProduct(): Promise<void> {
  try {
    // Register Commerce provisioner
    ProductProvisionerRegistry.register('COMMERCE', commerceProvisioner)

    // Update product runtime configuration for LOCAL_MODULE deployment
    await db.platformProduct.update({
      where: { code: 'COMMERCE' },
      data: {
        deploymentMode: 'LOCAL_MODULE',
        deploymentStatus: 'READY',
        apiBaseUrl: null, // Local, no external API needed
        healthCheckUrl: '/api/products/commerce/health',
        provisionerName: 'CommerceProvisioner',
        lastDeploymentAt: new Date(),
      },
    })

    console.log('[COMMERCE] Product initialized and registered')
  } catch (error) {
    // Provisioner already registered or product not found is OK
    if (
      error instanceof Error &&
      (error.message.includes('already registered') || error.message.includes('not found'))
    ) {
      return
    }
    console.error('[COMMERCE] Initialization error:', error)
  }
}
