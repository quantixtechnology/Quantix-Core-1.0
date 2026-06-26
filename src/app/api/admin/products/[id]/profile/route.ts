// ============================================================================
// GET /api/admin/products/[id]/profile
// Get complete product profile with all management data
// Super Admin only
// ============================================================================

import { withMiddleware } from '@/lib/middleware'
import { getCompleteProductProfile } from '@/lib/product-management'
import { getProductRolePermissions } from '@/lib/product-permissions'

type Ctx = {
  params?: Promise<Record<string, string | string[]>>
}

export const GET = withMiddleware({ permission: 'products:view' })(
  async (req, ctx: Ctx) => {
    try {
      const params = await ctx.params
      const productCode = params?.id as string

      if (!productCode) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Product code is required',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      }

      const profile = await getCompleteProductProfile(productCode)

      if (!profile) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Product not found',
          }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        )
      }

      // Include role permissions
      const rolePermissions = getProductRolePermissions(productCode)

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            ...profile,
            rolePermissions,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    } catch (error) {
      console.error('Error fetching product profile:', error)
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to fetch product profile',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }
)
