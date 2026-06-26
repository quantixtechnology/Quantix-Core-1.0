// ============================================================================
// GET /api/admin/products/runtime
// List all product runtime information
// Super Admin only (read-only)
// ============================================================================

import { withMiddleware } from '@/lib/middleware'
import { ProductRuntimeRegistry } from '@/lib/product-runtime-registry'

export const GET = withMiddleware({ permission: 'products:view' })(
  async (req) => {
    try {
      const products = await ProductRuntimeRegistry.getAllProducts()

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            totalProducts: products.length,
            products,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    } catch (error) {
      console.error('Error fetching product runtime:', error)
      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch runtime',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }
)
