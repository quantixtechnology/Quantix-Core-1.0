// ============================================================================
// POST /api/admin/businesses/provision
// Trigger business provisioning (called after business creation)
// Super Admin only
// ============================================================================

import { withMiddleware } from '@/lib/middleware'
import { provisionBusiness, getProvisioningStatus } from '@/lib/business-provisioning'
import { validateOwnerAccount } from '@/lib/owner-account'

// SECURITY: `requiredPermission` is only enforced inside withMiddleware's
// `requireAuth` branch, so this route was previously reachable unauthenticated.
// That is not acceptable now that it sets the owner's email and password —
// requireAuth + requirePlatformAdmin make it platform-staff-only, matching the
// Owner Account editor. requirePlatformAdmin resolves from User.platformRole,
// which no tenant role can hold.
export const POST = withMiddleware({
  requireAuth: true,
  requirePlatformAdmin: true,
  requiredPermission: 'businesses:create',
})(
  async (req) => {
    try {
      const body = await req.json()
      const { businessId, ownerPassword, confirmPassword, ownerName, ownerEmail, ownerPhone } = body

      if (!businessId) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Missing required field: businessId',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      }

      // Owner identity + initial password, validated by the SAME rules the
      // Owner Account editor uses, so a password accepted at creation would be
      // accepted later and vice versa. All fields are optional: when omitted,
      // provisioning falls back to the business record and generates a temp
      // password.
      const invalid = validateOwnerAccount({
        name: ownerName ?? undefined,
        email: ownerEmail ?? undefined,
        password: ownerPassword ?? undefined,
        // Confirmation is only meaningful when one was supplied; the wizard
        // always sends it alongside a password.
        confirmPassword: ownerPassword ? (confirmPassword ?? ownerPassword) : undefined,
      })
      if (invalid) {
        return new Response(
          JSON.stringify({ success: false, error: invalid }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      }

      // Trigger provisioning
      const result = await provisionBusiness(businessId, {
        ownerPassword: ownerPassword || undefined,
        ownerName: ownerName || undefined,
        ownerEmail: ownerEmail || undefined,
        ownerPhone: ownerPhone || undefined,
      })

      return new Response(
        JSON.stringify({
          success: result.success,
          data: {
            workspaceId: result.workspaceId,
            success: result.success,
            error: result.error,
            steps: result.steps,
            stepsTotal: result.stepsTotal,
            // Whether the admin can do anything about it. Only a PERMANENT
            // failure should put a Retry button in front of them — a transient
            // one has already been retried, here, automatically.
            failureKind: result.failureKind,
            failedStep: result.failedStep,
            resumedFrom: result.resumedFrom,
            // Present only when the Super Admin did not supply a password.
            ownerTempPassword: result.ownerTempPassword,
            // The email already had a platform account and was reused. If it
            // already had a password it kept it, so the one entered here was
            // never applied — the Super Admin has to be told, or they hand over
            // a credential that does not work.
            ownerLinkedExistingUser: result.ownerLinkedExistingUser,
            ownerPasswordUnchanged: result.ownerPasswordUnchanged,
            ownerAccountInactive: result.ownerAccountInactive,
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
// SECURITY: same gap as the POST above — `requiredPermission` alone is only
// enforced inside withMiddleware's requireAuth branch, so this reported a
// tenant's provisioning progress to anyone who asked.
export const GET = withMiddleware({
  requireAuth: true,
  requirePlatformAdmin: true,
  requiredPermission: 'businesses:view',
})(
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
