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
          laundryBusinessId: businessId,
          storeCode: `${business.slug}-laundry-1`,
          storeName: `${business.name} Laundry`,
          address: business.address || '',
          city: business.city || '',
          state: business.state || '',
          pincode: business.pincode || '',
          isActive: true,
          mobile: business.contactPhone || '',
          email: business.contactEmail || '',
        },
      })

      // 2. Create default processing center
      const processingCenter = await db.laundryProcessingCenter.create({
        data: {
          businessId,
          centerName: `${business.name} Processing Center`,
          centerCode: `${business.slug}-processing-1`,
          address: business.address || '',
          dailyCapacityKg: 1000,
        },
      })

      // Auto-provision BOTH public apps (customer <domain> + executive
      // delivery.<domain>) via the shared engine — no manual infra step. Runs in
      // the background (certbot needs DNS to resolve, which may lag creation); the
      // Mobile Apps status view auto-heals it once DNS + server are ready.
      void import("@/lib/laundry-app-provisioning")
        .then((m) => m.provisionTenantApps(businessId))
        .catch(() => { /* best-effort; retryable from Mobile Apps */ })

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
