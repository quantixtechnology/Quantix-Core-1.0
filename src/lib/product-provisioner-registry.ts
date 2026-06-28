// ============================================================================
// Product Provisioner Registry (v1.3.1)
// Decouples Quantix Core from Product Implementations
// Supports dynamic product registration without Core modifications
// ============================================================================

import type { ProductProvisioner, ProductProvisioningConfig, ProductProvisioningResult } from './product-provisioning-interface'
import { commerceProvisioner } from './products/commerce-provisioner'
import { laundryProvisioner } from './products/laundry-provisioner'

/**
 * Registry entry for a product provisioner
 */
interface RegistryEntry {
  productCode: string
  provisioner: ProductProvisioner
  registeredAt: Date
}

/**
 * Product Provisioner Registry
 * Singleton registry for all product provisioners
 *
 * Architecture Principle:
 * - Quantix Core uses this registry, not hardcoded product logic
 * - Each Product registers its provisioner at startup
 * - Future products can be added without modifying Core
 * - Quantix Core never knows about product implementations
 *
 * Usage:
 *   ProductProvisionerRegistry.register('COMMERCE', commerceProvisioner)
 *   const provisioner = ProductProvisionerRegistry.get('COMMERCE')
 *   await provisioner.provision(businessId, config)
 */
class ProductProvisionerRegistryImpl {
  private registry: Map<string, RegistryEntry> = new Map()

  /**
   * Register a product provisioner
   * This is called by each product at startup
   *
   * @param productCode - Unique product code (e.g., 'COMMERCE', 'LAUNDRY')
   * @param provisioner - ProductProvisioner implementation
   * @throws Error if product already registered
   *
   * @example
   * // In Commerce product startup
   * ProductProvisionerRegistry.register('COMMERCE', {
   *   async provision(businessId, config) {
   *     // Commerce-specific provisioning
   *   }
   * })
   */
  register(productCode: string, provisioner: ProductProvisioner): void {
    const normalizedCode = productCode.toUpperCase()

    // Validate product code
    if (!normalizedCode || normalizedCode.trim().length === 0) {
      throw new Error('Product code cannot be empty')
    }

    // Prevent duplicate registrations
    if (this.registry.has(normalizedCode)) {
      throw new Error(`Product ${normalizedCode} already registered`)
    }

    // Validate provisioner
    if (!provisioner || typeof provisioner.provision !== 'function') {
      throw new Error(`Invalid provisioner for product ${normalizedCode}`)
    }

    // Register provisioner
    this.registry.set(normalizedCode, {
      productCode: normalizedCode,
      provisioner,
      registeredAt: new Date(),
    })
  }

  /**
   * Get a product provisioner
   * This is called by Quantix Core provisioning engine
   *
   * @param productCode - Product code to look up
   * @returns ProductProvisioner or null if not registered
   *
   * @example
   * const provisioner = ProductProvisionerRegistry.get('COMMERCE')
   * if (provisioner) {
   *   await provisioner.provision(businessId, config)
   * }
   */
  get(productCode: string): ProductProvisioner | null {
    const normalizedCode = productCode.toUpperCase()
    const entry = this.registry.get(normalizedCode)
    return entry ? entry.provisioner : null
  }

  /**
   * Check if a product provisioner is registered
   *
   * @param productCode - Product code to check
   * @returns true if provisioner is registered
   */
  has(productCode: string): boolean {
    const normalizedCode = productCode.toUpperCase()
    return this.registry.has(normalizedCode)
  }

  /**
   * List all registered provisioners
   * Useful for debugging and monitoring
   *
   * @returns Array of registered product codes
   */
  list(): string[] {
    return Array.from(this.registry.keys())
  }

  /**
   * Get all registry entries (for admin/debugging)
   *
   * @returns Array of registry entries with metadata
   */
  listDetails(): Array<{
    productCode: string
    registeredAt: Date
  }> {
    return Array.from(this.registry.values()).map((entry) => ({
      productCode: entry.productCode,
      registeredAt: entry.registeredAt,
    }))
  }

  /**
   * Unregister a product provisioner
   * Used for testing and cleanup
   *
   * @param productCode - Product code to unregister
   * @throws Error if product not registered
   */
  unregister(productCode: string): void {
    const normalizedCode = productCode.toUpperCase()

    if (!this.registry.has(normalizedCode)) {
      throw new Error(`Product ${normalizedCode} not registered`)
    }

    this.registry.delete(normalizedCode)
  }

  /**
   * Clear all registrations
   * Used for testing only
   */
  clear(): void {
    this.registry.clear()
  }

  /**
   * Get registry size
   * Useful for monitoring
   */
  size(): number {
    return this.registry.size
  }
}

/**
 * Singleton instance of the registry
 * Used throughout the application
 */
export const ProductProvisionerRegistry = new ProductProvisionerRegistryImpl()

// ── First-party provisioner bootstrap ───────────────────────────────────────
// Provisioning runs inside API route handlers (engine: business-provisioning.ts
// → this module). Under Next.js the route-handler module graph is isolated from
// the RSC layout where <PlatformInitializer> registers products, and also from
// the startup instrumentation hook — so provisioners registered there were not
// visible to the engine and `has()` fell through to its no-op fallback, silently
// skipping Commerce/Laundry resource creation. Registering the first-party
// provisioners here, at module load in the same graph the engine imports,
// guarantees the registry is populated for every provision request, in every
// runtime. Registration is idempotent: skip if already present (e.g. when
// PlatformInitializer also runs in this graph).
for (const [code, provisioner] of [
  ['COMMERCE', commerceProvisioner],
  ['LAUNDRY', laundryProvisioner],
] as const) {
  if (!ProductProvisionerRegistry.has(code)) {
    ProductProvisionerRegistry.register(code, provisioner)
  }
}

/**
 * Helper function for Quantix Core to safely call product provisioners
 * Handles missing provisioners gracefully
 *
 * @param businessId - Business being provisioned
 * @param productCode - Product code
 * @param config - Provisioning configuration
 * @returns Provisioning result
 * @throws Error if provisioner not found or provision fails
 *
 * @example
 * const result = await provisionWithRegistry(businessId, 'COMMERCE', config)
 */
export async function provisionWithRegistry(
  businessId: string,
  productCode: string,
  config: ProductProvisioningConfig
): Promise<ProductProvisioningResult> {
  const provisioner = ProductProvisionerRegistry.get(productCode)

  if (!provisioner) {
    throw new Error(
      `No provisioner registered for product ${productCode}. ` +
      `Available products: ${ProductProvisionerRegistry.list().join(', ') || 'none'}`
    )
  }

  try {
    const result = await provisioner.provision(businessId, config)
    return result
  } catch (error) {
    throw new Error(
      `Product provisioning failed for ${productCode}: ` +
      (error instanceof Error ? error.message : String(error))
    )
  }
}

/**
 * Architecture Benefits:
 *
 * BEFORE (Hardcoded - WRONG):
 *   switch (productCode) {
 *     case 'COMMERCE': await provisionCommerceResources(...)
 *     case 'LAUNDRY': await provisionLaundryResources(...)
 *     case 'CARWASH': await provisionCarWashResources(...)
 *   }
 *   Problems:
 *   - Quantix Core contains product logic
 *   - Adding new product requires Core modification
 *   - Products tightly coupled to Core
 *   - No way to disable/enable products dynamically
 *
 * AFTER (Registry - CORRECT):
 *   const provisioner = ProductProvisionerRegistry.get(productCode)
 *   await provisioner.provision(businessId, config)
 *   Benefits:
 *   - Quantix Core knows nothing about product implementations
 *   - Products register themselves independently
 *   - Adding new product requires ZERO Core modifications
 *   - Products can be enabled/disabled dynamically
 *   - Future-proof for unlimited products
 *
 * FUTURE PRODUCTS (Salon OS, Restaurant OS, etc.):
 *   ProductProvisionerRegistry.register('SALON', salonProvisioner)
 *   ProductProvisionerRegistry.register('RESTAURANT', restaurantProvisioner)
 *   ProductProvisionerRegistry.register('CLINIC', clinicProvisioner)
 *   No Core changes needed.
 */
