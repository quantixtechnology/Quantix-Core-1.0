// ============================================================================
// Product Runtime Registry (v1.4.0)
// Manages Product Runtime Information
// Decouples Quantix Core from Product Deployment Details
// ============================================================================

import { db } from '@/lib/db'

/**
 * Product Runtime Information
 * All deployment and communication details for a product
 */
export interface ProductRuntime {
  productCode: string
  productName: string
  version: string
  workspaceUrl: string
  apiBaseUrl: string | null
  healthCheckUrl: string | null
  provisionerName: string | null
  deploymentMode: 'LOCAL_MODULE' | 'SUBDOMAIN' | 'REMOTE_SERVICE' | 'CONTAINER'
  deploymentStatus: 'READY' | 'DEPLOYING' | 'FAILED' | 'MAINTENANCE'
  supportedApiVersion: string
  buildNumber: string | null
  lastDeploymentAt: Date | null
  lastHealthCheckAt: Date | null
  lastHealthCheckStatus: string | null
}

/**
 * Product Health Status
 * Result of health check call to product
 */
export interface ProductHealthStatus {
  productCode: string
  status: 'HEALTHY' | 'WARNING' | 'OFFLINE'
  timestamp: Date
  message?: string
  details?: Record<string, any>
}

/**
 * Product Runtime Registry
 * Provides centralized access to product runtime information
 * Quantix Core never hardcodes product URLs or deployment details
 */
class ProductRuntimeRegistryImpl {
  /**
   * Get product runtime information
   * Used by Quantix Core to communicate with products
   *
   * @param productCode - Product code (e.g., 'COMMERCE', 'LAUNDRY')
   * @returns ProductRuntime or null if not found
   */
  async getRuntime(productCode: string): Promise<ProductRuntime | null> {
    const product = await db.platformProduct.findUnique({
      where: { code: productCode.toUpperCase() },
    })

    if (!product) {
      return null
    }

    return {
      productCode: product.code,
      productName: product.name,
      version: product.currentVersion,
      workspaceUrl: product.workspaceUrl,
      apiBaseUrl: product.apiBaseUrl,
      healthCheckUrl: product.healthCheckUrl,
      provisionerName: product.provisionerName,
      deploymentMode: (product.deploymentMode as any) || 'LOCAL_MODULE',
      deploymentStatus: (product.deploymentStatus as any) || 'READY',
      supportedApiVersion: product.supportedApiVersion,
      buildNumber: product.buildNumber,
      lastDeploymentAt: product.lastDeploymentAt,
      lastHealthCheckAt: product.lastHealthCheckAt,
      lastHealthCheckStatus: product.lastHealthCheckStatus,
    }
  }

  /**
   * Get workspace URL for a product
   * Quick lookup for workspace routing
   *
   * @param productCode - Product code
   * @returns Workspace URL or null
   */
  async getWorkspaceUrl(productCode: string): Promise<string | null> {
    const runtime = await this.getRuntime(productCode)
    return runtime ? runtime.workspaceUrl : null
  }

  /**
   * Get API base URL for a product
   * Used for API communication
   *
   * @param productCode - Product code
   * @returns API URL or null
   */
  async getApiBaseUrl(productCode: string): Promise<string | null> {
    const runtime = await this.getRuntime(productCode)
    return runtime ? runtime.apiBaseUrl : null
  }

  /**
   * Get health check URL for a product
   *
   * @param productCode - Product code
   * @returns Health check URL or null
   */
  async getHealthCheckUrl(productCode: string): Promise<string | null> {
    const runtime = await this.getRuntime(productCode)
    return runtime ? runtime.healthCheckUrl : null
  }

  /**
   * Check if product is ready for use
   *
   * @param productCode - Product code
   * @returns true if deployment status is READY
   */
  async isReady(productCode: string): Promise<boolean> {
    const runtime = await this.getRuntime(productCode)
    return runtime ? runtime.deploymentStatus === 'READY' : false
  }

  /**
   * Get all registered products
   * Returns all products with their runtime information
   *
   * @returns Array of ProductRuntime
   */
  async getAllProducts(): Promise<ProductRuntime[]> {
    const products = await db.platformProduct.findMany({
      where: {
        status: 'ACTIVE',
        isEnabled: true,
      },
    })

    return products.map((p) => ({
      productCode: p.code,
      productName: p.name,
      version: p.currentVersion,
      workspaceUrl: p.workspaceUrl,
      apiBaseUrl: p.apiBaseUrl,
      healthCheckUrl: p.healthCheckUrl,
      provisionerName: p.provisionerName,
      deploymentMode: (p.deploymentMode as any) || 'LOCAL_MODULE',
      deploymentStatus: (p.deploymentStatus as any) || 'READY',
      supportedApiVersion: p.supportedApiVersion,
      buildNumber: p.buildNumber,
      lastDeploymentAt: p.lastDeploymentAt,
      lastHealthCheckAt: p.lastHealthCheckAt,
      lastHealthCheckStatus: p.lastHealthCheckStatus,
    }))
  }

  /**
   * Register or update product runtime information
   * Called when product is deployed or updated
   *
   * @param productCode - Product code
   * @param runtime - Runtime information to register
   */
  async registerRuntime(
    productCode: string,
    runtime: Partial<ProductRuntime>
  ): Promise<ProductRuntime | null> {
    const updated = await db.platformProduct.update({
      where: { code: productCode.toUpperCase() },
      data: {
        workspaceUrl: runtime.workspaceUrl || undefined,
        apiBaseUrl: runtime.apiBaseUrl || undefined,
        healthCheckUrl: runtime.healthCheckUrl || undefined,
        provisionerName: runtime.provisionerName || undefined,
        deploymentMode: runtime.deploymentMode || undefined,
        deploymentStatus: runtime.deploymentStatus || undefined,
        supportedApiVersion: runtime.supportedApiVersion || undefined,
        buildNumber: runtime.buildNumber || undefined,
        currentVersion: runtime.version || undefined,
      },
    })

    return this.getRuntime(productCode)
  }

  /**
   * Update product health check status
   * Called after health check is performed
   *
   * @param productCode - Product code
   * @param status - Health status
   */
  async updateHealthStatus(
    productCode: string,
    status: ProductHealthStatus
  ): Promise<void> {
    await db.platformProduct.update({
      where: { code: productCode.toUpperCase() },
      data: {
        lastHealthCheckAt: new Date(),
        lastHealthCheckStatus: status.status,
      },
    })
  }

  /**
   * Update deployment status
   * Called when deployment starts/completes
   *
   * @param productCode - Product code
   * @param status - Deployment status
   * @param buildNumber - Optional build number
   */
  async updateDeploymentStatus(
    productCode: string,
    status: 'READY' | 'DEPLOYING' | 'FAILED' | 'MAINTENANCE',
    buildNumber?: string
  ): Promise<void> {
    await db.platformProduct.update({
      where: { code: productCode.toUpperCase() },
      data: {
        deploymentStatus: status,
        lastDeploymentAt: status === 'READY' ? new Date() : undefined,
        buildNumber: buildNumber || undefined,
      },
    })
  }

  /**
   * Get provisioner name for a product
   * Used by provisioner registry
   *
   * @param productCode - Product code
   * @returns Provisioner name or null
   */
  async getProvisionerName(productCode: string): Promise<string | null> {
    const runtime = await this.getRuntime(productCode)
    return runtime ? runtime.provisionerName : null
  }

  /**
   * Validate product runtime is complete
   * Ensures all required fields are set
   *
   * @param productCode - Product code
   * @returns Validation result
   */
  async validateRuntime(productCode: string): Promise<{ valid: boolean; errors: string[] }> {
    const runtime = await this.getRuntime(productCode)
    const errors: string[] = []

    if (!runtime) {
      errors.push('Product not found')
      return { valid: false, errors }
    }

    if (!runtime.workspaceUrl) {
      errors.push('workspaceUrl is required')
    }

    if (!runtime.apiBaseUrl) {
      errors.push('apiBaseUrl is required')
    }

    if (!runtime.healthCheckUrl) {
      errors.push('healthCheckUrl is required')
    }

    if (!runtime.provisionerName) {
      errors.push('provisionerName is required')
    }

    if (runtime.deploymentStatus !== 'READY') {
      errors.push(`deploymentStatus must be READY (current: ${runtime.deploymentStatus})`)
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }
}

/**
 * Singleton instance of Product Runtime Registry
 */
export const ProductRuntimeRegistry = new ProductRuntimeRegistryImpl()

/**
 * Architecture Benefits:
 *
 * Before (Hardcoded - WRONG):
 *   const commerceUrl = 'https://commerce.quantixtechnology.in'
 *   const laundryUrl = 'https://laundry.quantixtechnology.in'
 *   switch (productCode) {
 *     case 'COMMERCE': return commerceUrl
 *     case 'LAUNDRY': return laundryUrl
 *   }
 *
 * After (Registry - CORRECT):
 *   const url = await ProductRuntimeRegistry.getWorkspaceUrl(productCode)
 *
 * Benefits:
 * - No hardcoded URLs anywhere
 * - Products register their own runtime
 * - Deployment information centralized
 * - Support for multiple deployment modes
 * - Health status tracking
 * - Ready for product extraction
 */
