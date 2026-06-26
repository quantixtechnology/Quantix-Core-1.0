// ============================================================================
// GET /api/admin/provisioners/registry
// List registered Product Provisioners
// Admin/Super Admin only
// ============================================================================

import { withMiddleware } from '@/lib/middleware'
import { ProductProvisionerRegistry } from '@/lib/product-provisioner-registry'

/**
 * List all registered product provisioners
 * Useful for debugging and monitoring
 */
export const GET = withMiddleware(
  async (req) => {
    try {
      const registeredProducts = ProductProvisionerRegistry.listDetails()

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            totalRegistered: registeredProducts.length,
            provisioners: registeredProducts,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    } catch (error) {
      console.error('Error fetching provisioner registry:', error)
      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch registry',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }
  },
  { permission: 'products:view' }
)
