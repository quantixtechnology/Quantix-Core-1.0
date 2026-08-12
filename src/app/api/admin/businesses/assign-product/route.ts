// ============================================================================
// POST /api/admin/businesses/assign-product
// Assign a product to a business during creation
// Super Admin only
// ============================================================================

import { withMiddleware } from '@/lib/middleware'
import {
  assignProductToBusiness,
  validateProductAssignment,
} from '@/lib/business-product-assignment'

// SECURITY: assigning a product + plan to a business is platform licensing —
// it decides what a tenant is entitled to. Same gap as the provisioning routes:
// `requiredPermission` alone is inert without requireAuth.
export const POST = withMiddleware({
  requireAuth: true,
  requirePlatformAdmin: true,
  requiredPermission: 'businesses:create',
})(
  async (req) => {
    try {
      const body = await req.json()
      const { businessId, productCode, subscriptionPlanCode } = body

      if (!businessId || !productCode || !subscriptionPlanCode) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Missing required fields: businessId, productCode, subscriptionPlanCode',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      }

      // Validate assignment
      const validation = await validateProductAssignment(productCode, subscriptionPlanCode)
      if (!validation.valid) {
        return new Response(
          JSON.stringify({
            success: false,
            error: validation.error,
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      }

      // Assign product to business
      const updated = await assignProductToBusiness(businessId, productCode, subscriptionPlanCode)

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            businessId: updated.id,
            productCode: updated.productCode,
            productVersion: updated.productVersion,
            subscriptionPlanCode: updated.subscriptionPlanCode,
            enabledFeatures: JSON.parse(updated.enabledFeatures),
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    } catch (error) {
      console.error('Error assigning product to business:', error)
      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to assign product',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }
)
