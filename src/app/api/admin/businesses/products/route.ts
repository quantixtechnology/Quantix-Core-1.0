// ============================================================================
// GET /api/admin/businesses/products
// List available products for business creation
// Super Admin only
// ============================================================================

import { withMiddleware } from '@/lib/middleware'
import { getAvailableProductsForCreation } from '@/lib/business-product-assignment'

export const GET = withMiddleware({ permission: 'businesses:create' })(
  async (req) => {
    try {
      const products = await getAvailableProductsForCreation()

      return new Response(
        JSON.stringify({
          success: true,
          data: products,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    } catch (error) {
      console.error('Error fetching products for business creation:', error)
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to fetch available products',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }
)
