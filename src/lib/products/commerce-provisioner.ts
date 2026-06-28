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
      // Field names must match the Store model: name + slug are required, the
      // contact field is `phone` (not phoneNumber), and storeCode is the
      // per-business code. (Previously used storeName/phoneNumber and omitted
      // name/slug, which made store.create throw and be swallowed.)
      const store = await db.store.create({
        data: {
          businessId,
          name: `${business.name} Store`,
          slug: `${business.slug}-store-1`,
          storeCode: `${business.slug}-store-1`,
          address: business.address || '',
          city: business.city || '',
          state: business.state || '',
          pincode: business.pincode || '',
          status: 'ACTIVE',
          isMainStore: true,
          phone: business.contactPhone || '',
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
