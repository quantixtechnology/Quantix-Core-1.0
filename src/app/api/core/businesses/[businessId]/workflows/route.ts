// ============================================================================
// GET /api/core/businesses/[businessId]/workflows
// Returns the enabled workflows for this business (set by Super Admin at provisioning).
// Auth required — used by the category form to know which workflows to show.
// ============================================================================

import { NextResponse } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'
import { getBusinessEnabledWorkflows } from '@/lib/core/business'
import type { NextRequest } from 'next/server'

type WorkflowType = 'ECOMMERCE' | 'PICKUP_DELIVERY' | 'APPOINTMENT' | 'SUBSCRIPTION' | 'POST_SERVICE_BILLING'

type Ctx = { params?: Promise<Record<string, string | string[]>> }

export const GET = withMiddleware({ requireAuth: true })(
  async (_req: NextRequest, ctx?: Ctx) => {
    try {
      const params = await ctx?.params
      const businessId = params?.businessId as string | undefined
      if (!businessId) return createErrorResponse('Missing businessId', 400)

      const business = await db.business.findUnique({
        where: { id: businessId },
        select: {
          settings: true,
          businessType: true,
          businessSubscription: {
            select: { plan: { select: { tier: true } } },
          },
        },
      })

      if (!business) return createErrorResponse('Business not found', 404)

      const planTier = business.businessSubscription?.plan?.tier ?? 'STANDARD'

      let enabledWorkflows: WorkflowType[]

      enabledWorkflows = getBusinessEnabledWorkflows(business.businessType, planTier, business.settings) as WorkflowType[]

      return NextResponse.json({
        success: true,
        data: {
          planTier,
          enabledWorkflows,
          isMultiWorkflow: enabledWorkflows.length > 1,
        },
      })
    } catch (error) {
      return createErrorResponse(
        error instanceof Error ? error.message : 'Failed to get workflows',
        500,
      )
    }
  },
)
