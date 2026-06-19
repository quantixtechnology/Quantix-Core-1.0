// ============================================================================
// GET /api/core/businesses/[businessId]/workflows
// Returns the enabled workflows for this business (set by Super Admin at provisioning).
// Auth required — used by the category form to know which workflows to show.
// ============================================================================

import { NextResponse } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'
import type { NextRequest } from 'next/server'

const ALL_WORKFLOWS = ['ECOMMERCE', 'PICKUP_DELIVERY', 'APPOINTMENT', 'SUBSCRIPTION', 'POST_SERVICE_BILLING'] as const
type WorkflowType = typeof ALL_WORKFLOWS[number]

const BUSINESS_TYPE_DEFAULT_WORKFLOWS: Record<string, WorkflowType[]> = {
  GROCERY:       ['ECOMMERCE', 'PICKUP_DELIVERY'],
  ECOMMERCE:     ['ECOMMERCE'],
  FOOD_DELIVERY: ['ECOMMERCE', 'PICKUP_DELIVERY'],
  LAUNDRY:       ['ECOMMERCE', 'PICKUP_DELIVERY', 'SUBSCRIPTION', 'POST_SERVICE_BILLING'],
  CAR_WASH:      ['ECOMMERCE', 'APPOINTMENT', 'SUBSCRIPTION', 'POST_SERVICE_BILLING'],
  PHARMACY:      ['ECOMMERCE', 'PICKUP_DELIVERY'],
  HOME_SERVICES: ['APPOINTMENT', 'POST_SERVICE_BILLING'],
  MEAT_DELIVERY: ['ECOMMERCE', 'PICKUP_DELIVERY'],
  COSMETICS:     ['ECOMMERCE'],
  FURNITURE:     ['ECOMMERCE'],
  DIRECTORY:     ['ECOMMERCE'],
}

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

      if (planTier === 'STANDARD') {
        enabledWorkflows = ['ECOMMERCE']
      } else {
        // PRO: read from settings, fallback to business-type defaults
        const settings = JSON.parse(business.settings || '{}') as Record<string, unknown>
        const fromSettings = settings.enabledWorkflows
        if (Array.isArray(fromSettings) && fromSettings.length > 0) {
          const valid = new Set<string>(ALL_WORKFLOWS)
          enabledWorkflows = (fromSettings as string[]).filter(w => valid.has(w)) as WorkflowType[]
        } else {
          enabledWorkflows = BUSINESS_TYPE_DEFAULT_WORKFLOWS[business.businessType] ?? ['ECOMMERCE']
        }
        if (enabledWorkflows.length === 0) enabledWorkflows = ['ECOMMERCE']
      }

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
