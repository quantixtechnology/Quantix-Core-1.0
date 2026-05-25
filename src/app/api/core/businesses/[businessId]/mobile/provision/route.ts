// ============================================================================
// QUANTIX CORE — Mobile Provision Trigger
// POST /api/core/businesses/[businessId]/mobile/provision
//   body: {} OR { retry: true }
//   Quantix Super Admin only.
//   Triggers (or re-triggers) mobile app provisioning for the business.
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { db } from '@/lib/db';
import { triggerMobileProvisioning, retryMobileProvisioning } from '@/lib/mobile-provision';

export const POST = withMiddleware({
  requireAuth: true,
  requiredRoles: ['QUANTIX_SUPER_ADMIN', 'QUANTIX_SALES_TEAM'],
})(async (req, context) => {
  try {
    const params = await context?.params;
    const businessId = params?.businessId as string;
    if (!businessId) {
      return NextResponse.json({ success: false, error: 'businessId is required' }, { status: 400 });
    }

    const business = await db.business.findUnique({
      where: { id: businessId },
      select: { id: true, slug: true, name: true, logo: true, primaryColor: true, businessType: true },
    });
    if (!business) {
      return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 });
    }

    const body = await req.json().catch(() => ({})) as { retry?: boolean };

    if (body.retry) {
      await retryMobileProvisioning(businessId, business.slug);
      return NextResponse.json({
        success: true,
        message: 'Mobile provisioning retry triggered',
        slug: business.slug,
      });
    }

    // Check for existing deployments — don't double-provision unless retry
    const existingDeployment = await db.deployment.findFirst({
      where: { businessId, type: 'CUSTOMER_APP' },
      select: { status: true },
    });
    if (existingDeployment && existingDeployment.status !== 'FAILED') {
      return NextResponse.json({
        success: false,
        error: `Mobile provisioning already in state: ${existingDeployment.status}. Pass { retry: true } to re-trigger.`,
        currentStatus: existingDeployment.status,
      }, { status: 409 });
    }

    await triggerMobileProvisioning({
      businessId,
      slug: business.slug,
      name: business.name,
      logo: business.logo,
      primaryColor: business.primaryColor,
      businessType: business.businessType,
      packageBase: `com.${business.slug.replace(/-/g, '')}`,
    });

    return NextResponse.json({
      success: true,
      message: 'Mobile provisioning triggered',
      slug: business.slug,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to trigger provisioning';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
