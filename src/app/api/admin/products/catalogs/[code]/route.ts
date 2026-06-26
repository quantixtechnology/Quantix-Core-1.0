// ============================================================================
// GET /api/admin/products/catalogs/[code]
// Get detailed catalog for a specific product including features and roles
// Super Admin only
// ============================================================================

import { withMiddleware } from '@/lib/middleware'
import { getProductWithCatalog } from '@/lib/product-registry-init'

type Ctx = {
  params?: Promise<Record<string, string | string[]>>
}

export const GET = withMiddleware(
  async (req, ctx: Ctx) => {
    try {
      const params = await ctx.params
      const code = params?.code as string

      if (!code) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Product code is required',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      }

      const product = await getProductWithCatalog(code)

      if (!product) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Product not found',
          }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            id: product.id,
            code: product.code,
            name: product.name,
            slug: product.slug,
            description: product.description,
            workspaceUrl: product.workspaceUrl,
            currentVersion: product.currentVersion,
            status: product.status,
            isEnabled: product.isEnabled,
            defaultStorageQuotaMB: product.defaultStorageQuotaMB,
            catalog: product.catalog || {
              features: [],
              roles: [],
              subscriptionPlans: [],
            },
            createdAt: product.createdAt,
            updatedAt: product.updatedAt,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    } catch (error) {
      console.error('Error fetching product catalog:', error)
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to fetch product catalog',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }
  },
  { permission: 'products:view' }
)
