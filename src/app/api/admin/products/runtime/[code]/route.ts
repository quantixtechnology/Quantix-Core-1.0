// ============================================================================
// GET /api/admin/products/runtime/[code]
// Get specific product runtime information and validation
// Super Admin only (read-only)
// ============================================================================

import { withMiddleware } from '@/lib/middleware'
import { ProductRuntimeRegistry } from '@/lib/product-runtime-registry'

export const GET = withMiddleware({ permission: 'products:view' })(
  async (req, { params }) => {
    try {
      const { code } = params

      if (!code) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Product code is required',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      }

      const runtime = await ProductRuntimeRegistry.getRuntime(code)

      if (!runtime) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Product ${code} not found`,
          }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        )
      }

      // Validate runtime completeness
      const validation = await ProductRuntimeRegistry.validateRuntime(code)

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            runtime,
            validation,
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
