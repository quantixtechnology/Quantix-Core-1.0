// ============================================================================
// POST /api/admin/businesses/provision
// Trigger business provisioning (called after business creation)
// Super Admin only
// ============================================================================

import { withMiddleware } from '@/lib/middleware'
import { provisionBusiness, getProvisioningStatus } from '@/lib/business-provisioning'

export const POST = withMiddleware({ requiredPermission: 'businesses:create' })(
  async (req) => {
    try {
      const body = await req.json()
      const { businessId, ownerPassword, confirmPassword } = body

      if (!businessId) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Missing required field: businessId',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      }

      // Initial owner password is optional; when provided it must be confirmed
      // and meet the minimum length. (If omitted, provisioning generates a temp.)
      if (ownerPassword !== undefined && ownerPassword !== null && ownerPassword !== '') {
        if (typeof ownerPassword !== 'string' || ownerPassword.length < 6) {
          return new Response(
            JSON.stringify({ success: false, error: 'Owner password must be at least 6 characters' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          )
        }
        if (confirmPassword !== undefined && confirmPassword !== ownerPassword) {
          return new Response(
            JSON.stringify({ success: false, error: 'Passwords do not match' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          )
        }
      }

      // Trigger provisioning
      const result = await provisionBusiness(businessId, { ownerPassword: ownerPassword || undefined })

      return new Response(
        JSON.stringify({
          success: result.success,
          data: {
            workspaceId: result.workspaceId,
            success: result.success,
            error: result.error,
            steps: result.steps,
            // Present only when the Super Admin did not supply a password.
            ownerTempPassword: result.ownerTempPassword,
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
  }
)

/**
 * GET /api/admin/businesses/provision?businessId=...
 * Get provisioning status
 */
export const GET = withMiddleware({ requiredPermission: 'businesses:view' })(
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
  }
)
