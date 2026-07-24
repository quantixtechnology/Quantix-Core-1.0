// Commerce Mobile Apps provisioning + HTTPS status for a tenant's THREE app hosts
// (Customer <domain>, Store Admin store.<domain>, Delivery Executive
// delivery.<domain>). Reuses the SAME product-agnostic engine the Laundry Mobile
// Apps hub uses — no duplicate DNS/Nginx/SSL logic. getTenantAppStatus returns
// { customer, executive, store }; `executive` IS the delivery.<domain> host.
//
// GET  — status + auto-heal: if the customer host is up but store/delivery aren't
//        secured yet, kick off provisioning in the background so the Business
//        Admin Mobile Apps page self-heals with no manual step.
// POST — explicit "Provision Again" retry for all three hosts.
import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { getTenantAppStatus, provisionTenantApps } from '@/lib/laundry-app-provisioning';

export const GET = withMiddleware({ requireAuth: true })(async (req) => {
  const businessId = new URL(req.url).searchParams.get('businessId');
  if (!businessId) return NextResponse.json({ success: false, error: 'businessId is required' }, { status: 400 });
  const status = await getTenantAppStatus(businessId);
  if (!status) return NextResponse.json({ success: true, data: null });

  // Auto-heal (no manual step): once the customer host is reachable (server + DNS
  // are up), provision any store/delivery host that isn't secured yet.
  const storeNeedsHeal = status.store.sslStatus === 'pending' || status.store.sslStatus === 'failed';
  const delNeedsHeal = status.executive.sslStatus === 'pending' || status.executive.sslStatus === 'failed';
  if (status.customer.httpsReachable && (storeNeedsHeal || delNeedsHeal)) {
    void provisionTenantApps(businessId).catch(() => {});
    if (storeNeedsHeal) status.store.sslStatus = 'provisioning';
    if (delNeedsHeal) status.executive.sslStatus = 'provisioning';
  }

  return NextResponse.json({
    success: true,
    data: { customer: status.customer, storeAdmin: status.store, deliveryExecutive: status.executive },
  });
});

export const POST = withMiddleware({ requireAuth: true })(async (req) => {
  const body = await req.json().catch(() => ({}));
  const businessId = body.businessId as string | undefined;
  if (!businessId) return NextResponse.json({ success: false, error: 'businessId is required' }, { status: 400 });
  const r = await provisionTenantApps(businessId);
  if (!r.ok) return NextResponse.json({ success: false, error: r.error }, { status: 400 });
  return NextResponse.json({
    success: true,
    data: { customer: { ssl: r.customer.ssl }, storeAdmin: { ssl: r.store.ssl }, deliveryExecutive: { ssl: r.executive.ssl } },
  });
});
