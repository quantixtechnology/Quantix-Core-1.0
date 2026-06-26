// ============================================================================
// Product Provisioning Interface (v1.3.0)
// Contract that each Product must implement
// Quantix Core calls this interface but never knows implementation details
// ============================================================================

/**
 * Configuration passed from Quantix Core to Product Provisioner
 * Products receive only the information they need, nothing more
 */
export interface ProductProvisioningConfig {
  // Business and product association
  businessId: string
  productCode: string
  subscriptionPlanCode: string
  enabledFeatures: string[]
  workspaceId: string
}

/**
 * Result returned from Product Provisioner
 * Simple success/failure contract
 */
export interface ProductProvisioningResult {
  success: boolean
  error?: string
  message?: string
}

/**
 * Product Provisioner Interface
 * Every Product must implement this interface
 *
 * Each Product owns its own provisioning logic:
 * - Commerce OS: Categories, Inventory, Tax, POS, Delivery
 * - Laundry OS: Services, Processing Centers, Audit, QC, Pickup
 * - Car Wash OS: Packages, Queue, Booking
 * - Future Products: Their own business logic
 *
 * Quantix Core doesn't know what happens inside provision()
 */
export interface ProductProvisioner {
  /**
   * Provision the product for a newly created business
   *
   * @param businessId - The business being provisioned
   * @param config - Provisioning configuration from Quantix Core
   * @returns ProvisioningResult with success/failure status
   *
   * Implementation Requirements:
   * - MUST be idempotent (safe to retry)
   * - MUST NOT have side effects if fails
   * - MUST handle all product-specific business logic
   * - MUST NOT modify Quantix Core data
   * - SHOULD use product workspace configuration storage
   */
  provision(businessId: string, config: ProductProvisioningConfig): Promise<ProductProvisioningResult>
}

/**
 * Example Implementation (Commerce OS)
 *
 * export const commerceProvisioner: ProductProvisioner = {
 *   async provision(businessId, config) {
 *     try {
 *       // Create default categories
 *       await createDefaultCategories(businessId)
 *
 *       // Create inventory defaults
 *       await createInventoryDefaults(businessId, config.subscriptionPlanCode)
 *
 *       // Create tax configuration
 *       await createTaxSettings(businessId)
 *
 *       // Create POS defaults
 *       await createPOSDefaults(businessId)
 *
 *       // Create delivery configuration
 *       await createDeliveryDefaults(businessId, config.enabledFeatures)
 *
 *       return { success: true }
 *     } catch (error) {
 *       return {
 *         success: false,
 *         error: error instanceof Error ? error.message : 'Unknown error'
 *       }
 *     }
 *   }
 * }
 *
 * // Register with Quantix Core
 * registerProductProvisioner('COMMERCE', commerceProvisioner)
 */

/**
 * Example Implementation (Laundry OS)
 *
 * export const laundryProvisioner: ProductProvisioner = {
 *   async provision(businessId, config) {
 *     try {
 *       // Create default laundry services
 *       await createLaundryServices(businessId, config.subscriptionPlanCode)
 *
 *       // Create processing centers
 *       await createProcessingCenters(businessId)
 *
 *       // Configure store audit
 *       await configureStoreAudit(businessId)
 *
 *       // Configure quality control
 *       await configureQualityControl(businessId, config.enabledFeatures)
 *
 *       // Configure pickup/delivery
 *       await configurePickup(businessId)
 *
 *       return { success: true }
 *     } catch (error) {
 *       return {
 *         success: false,
 *         error: error instanceof Error ? error.message : 'Unknown error'
 *       }
 *     }
 *   }
 * }
 *
 * // Register with Quantix Core
 * registerProductProvisioner('LAUNDRY', laundryProvisioner)
 */

/**
 * Example Implementation (Car Wash OS)
 *
 * export const carwashProvisioner: ProductProvisioner = {
 *   async provision(businessId, config) {
 *     try {
 *       // Create service packages
 *       await createServicePackages(businessId, config.subscriptionPlanCode)
 *
 *       // Configure queue system
 *       await configureQueue(businessId)
 *
 *       // Configure booking system
 *       await configureBooking(businessId, config.enabledFeatures)
 *
 *       return { success: true }
 *     } catch (error) {
 *       return {
 *         success: false,
 *         error: error instanceof Error ? error.message : 'Unknown error'
 *       }
 *     }
 *   }
 * }
 *
 * // Register with Quantix Core
 * registerProductProvisioner('CARWASH', carwashProvisioner)
 */

/**
 * Architecture Principle:
 *
 * Quantix Core (Platform Controller):
 * ✓ Validates product and plan
 * ✓ Assigns features from plan
 * ✓ Allocates storage
 * ✓ Creates platform roles/permissions
 * ✓ Creates workspace record
 * ✓ Calls product provisioner
 * ✓ Marks workspace READY when complete
 *
 * Product (Business Operating System):
 * ✓ Provisions own categories/services/packages
 * ✓ Configures own defaults
 * ✓ Sets own business logic
 * ✓ Manages own data structures
 *
 * Quantix Core NEVER knows:
 * ✗ Commerce categories
 * ✗ Laundry services
 * ✗ Car Wash packages
 * ✗ Any product-specific business logic
 *
 * Products receive:
 * - businessId (which business to provision)
 * - productCode (which product)
 * - subscriptionPlanCode (which plan was selected)
 * - enabledFeatures (which features are licensed)
 * - workspaceId (where to store configuration)
 */
