// ============================================================================
// Commerce OS Provisioner
// Handles Commerce-specific provisioning logic
// ============================================================================

import type { ProductProvisioner, ProductProvisioningConfig, ProductProvisioningResult } from '@/lib/product-provisioning-interface'
import { db } from '@/lib/db'

/**
 * Commerce OS Provisioner
 * Provisions Commerce features for a business
 */
class CommerceProvisioner implements ProductProvisioner {
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

      // Commerce-specific provisioning
      // 1. Create default store
      const store = await db.store.create({
        data: {
          businessId,
          storeCode: `${business.slug}-store-1`,
          storeName: `${business.name} Store`,
          address: business.address || '',
          city: business.city || '',
          state: business.state || '',
          pincode: business.pincode || '',
          status: 'ACTIVE',
          isMainStore: true,
          phoneNumber: business.contactPhone || '',
          email: business.contactEmail || '',
        },
      })

      // 2. Set up default payment gateway
      const paymentGateway = await db.paymentGateway.create({
        data: {
          storeId: store.id,
          businessId,
          provider: 'RAZORPAY',
          status: 'ACTIVE',
          metadata: '{}',
        },
      })

      // 3. Initialize billing account
      const billingAccount = await db.billingAccount.create({
        data: {
          businessId,
          status: 'ACTIVE',
          currency: 'INR',
          metadata: '{}',
        },
      })

      return {
        success: true,
        message: `Commerce OS provisioned for business ${business.name}`,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return {
        success: false,
        error: `Commerce provisioning failed: ${message}`,
      }
    }
  }
}

// Export singleton instance
export const commerceProvisioner = new CommerceProvisioner()
