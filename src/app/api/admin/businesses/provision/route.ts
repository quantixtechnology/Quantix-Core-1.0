// ============================================================================
// POST /api/admin/businesses/provision
// Trigger business provisioning (called after business creation)
// Super Admin only
// ============================================================================

import { withMiddleware } from '@/lib/middleware'
import { provisionBusiness, getProvisioningStatus } from '@/lib/business-provisioning'

export const POST = withMiddleware(
  async (req) => {
    try {
      const body = await req.json()
      const { businessId } = body

      if (!businessId) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Missing required field: businessId',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      }

      // Trigger provisioning
      const result = await provisionBusiness(businessId)

      return new Response(
        JSON.stringify({
          success: result.success,
          data: {
            workspaceId: result.workspaceId,
            success: result.success,
            error: result.error,
            steps: result.steps,
          },
        }),
        { status: result.success ? 200 : 500, headers: { 'Content-Type': 'application/json' } }
      )
    } catch (error) {
      console.error('Error provisioning business:', error)
      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to provision business',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }
  },
  { permission: 'businesses:create' }
)

/**
 * GET /api/admin/businesses/provision?businessId=...
 * Get provisioning status
 */
export const GET = withMiddleware(
  async (req) => {
    try {
      const url = new URL(req.url)
      const businessId = url.searchParams.get('businessId')

      if (!businessId) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Missing required parameter: businessId',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      }

      const status = await getProvisioningStatus(businessId)

      return new Response(
        JSON.stringify({
          success: true,
          data: status,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    } catch (error) {
      console.error('Error getting provisioning status:', error)
      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get provisioning status',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }
  },
  { permission: 'businesses:view' }
)
