// ============================================================================
// GET /api/admin/businesses/products
// List available products for business creation
// Super Admin only
// ============================================================================

import { withMiddleware } from '@/lib/middleware'
import { getAvailableProductsForCreation } from '@/lib/business-product-assignment'

// SECURITY: the header above already said "Super Admin only" — the guard just
// never enforced it, because `requiredPermission` is checked inside
// withMiddleware's requireAuth branch. This exposed the platform product/plan
// catalogue publicly.
export const GET = withMiddleware({
  requireAuth: true,
  requirePlatformAdmin: true,
  requiredPermission: 'businesses:create',
})(
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
