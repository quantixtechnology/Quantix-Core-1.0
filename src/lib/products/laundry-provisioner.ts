// ============================================================================
// Laundry OS Provisioner
// Handles Laundry-specific provisioning logic
// ============================================================================

import type { ProductProvisioner, ProductProvisioningConfig, ProductProvisioningResult } from '@/lib/product-provisioning-interface'
import { db } from '@/lib/db'

/**
 * Laundry OS Provisioner
 * Provisions Laundry features for a business
 */
class LaundryProvisioner implements ProductProvisioner {
  async provision(
    businessId: string,
    config: ProductProvisioningConfig
  ): Promise<ProductProvisioningResult> {
    try {
      // Get business details
      const business = await db.business.findUnique({
        where: { id: businessId },
      })

      if (!business) {
        return {
          success: false,
          error: `Business ${businessId} not found`,
        }
      }

      // Laundry-specific provisioning
      // 1. Create default laundry store
      const laundryStore = await db.laundryStore.create({
        data: {
          businessId,
          storeCode: `${business.slug}-laundry-1`,
          storeName: `${business.name} Laundry`,
          address: business.address || '',
          city: business.city || '',
          state: business.state || '',
          pincode: business.pincode || '',
          status: 'ACTIVE',
          contactPhone: business.contactPhone || '',
          contactEmail: business.contactEmail || '',
        },
      })

      // 2. Create default processing center
      const processingCenter = await db.laundryProcessingCenter.create({
        data: {
          businessId,
          storeId: laundryStore.id,
          centerName: `${business.name} Processing Center`,
          centerCode: `${business.slug}-processing-1`,
          status: 'ACTIVE',
          address: business.address || '',
          capacity: 1000,
        },
      })

      return {
        success: true,
        message: `Laundry OS provisioned for business ${business.name}`,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return {
        success: false,
        error: `Laundry provisioning failed: ${message}`,
      }
    }
  }
}

// Export singleton instance
export const laundryProvisioner = new LaundryProvisioner()
