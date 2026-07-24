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

      // Commerce-specific provisioning. Each step is idempotent (find-or-create)
      // so a re-provision of the same business never duplicates resources or
      // trips a unique constraint.

      // 1. Create default store
      // Field names must match the Store model: name + slug are required, the
      // contact field is `phone` (not phoneNumber), and storeCode is the
      // per-business code. (Previously used storeName/phoneNumber and omitted
      // name/slug, which made store.create throw and be swallowed.)
      let store = await db.store.findFirst({
        where: { businessId, isMainStore: true },
      })
      if (!store) {
        store = await db.store.create({
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
      }

      // 2. Set up default payment gateway
      // Field names must match the PaymentGateway model: `name` + `gateway` are
      // required, the enabled flag is `isActive`, and credentials live in
      // `config`. (Previously used storeId/provider/status/metadata, none of
      // which exist on the model — the create threw and was swallowed.)
      const existingGateway = await db.paymentGateway.findFirst({
        where: { businessId, name: 'Razorpay' },
      })
      if (!existingGateway) {
        await db.paymentGateway.create({
          data: {
            businessId,
            name: 'Razorpay',
            gateway: 'RAZORPAY',
            isActive: true,
            config: '{}',
          },
        })
      }

      // 3. Initialize billing account (one per business — businessId is unique)
      // The BillingAccount model has no status/metadata fields; currency is the
      // meaningful default. (Previously passed status/metadata, which threw.)
      const existingBilling = await db.billingAccount.findUnique({
        where: { businessId },
      })
      if (!existingBilling) {
        await db.billingAccount.create({
          data: {
            businessId,
            currency: 'INR',
          },
        })
      }

      // Auto-provision the THREE public app hosts (customer <domain>, store
      // store.<domain>, delivery delivery.<domain>) via the SAME shared engine
      // Laundry uses — no duplicate DNS/Nginx/SSL logic. Background/best-effort
      // (certbot needs DNS to resolve, which may lag creation); the Mobile Apps
      // status view auto-heals it once DNS + server are ready.
      void import("@/lib/laundry-app-provisioning")
        .then((m) => m.provisionTenantApps(businessId))
        .catch(() => { /* best-effort; retryable from Mobile Apps */ })

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
