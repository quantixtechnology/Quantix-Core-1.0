// GET /api/core/mobile-apps/status?businessId= — provisioning + HTTPS status for a
// tenant's THREE app hosts (Customer <domain>, Store Admin store.<domain>, Delivery
// Executive delivery.<domain>). Reuses the SAME product-agnostic engine the Laundry
// Mobile Apps hub uses (getTenantAppStatus) — no duplicate provisioning logic. Note:
// getTenantAppStatus returns { customer, executive, store }; `executive` IS the
// delivery.<domain> host (the Delivery Executive PWA) for both workspaces.
import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { getTenantAppStatus } from '@/lib/laundry-app-provisioning';

export const GET = withMiddleware({ requireAuth: true })(async (req) => {
  const businessId = new URL(req.url).searchParams.get('businessId');
  if (!businessId) return NextResponse.json({ success: false, error: 'businessId is required' }, { status: 400 });
  const status = await getTenantAppStatus(businessId);
  if (!status) return NextResponse.json({ success: true, data: null });
  return NextResponse.json({
    success: true,
    data: {
      customer: status.customer,
      storeAdmin: status.store,
      deliveryExecutive: status.executive,
    },
  });
});
