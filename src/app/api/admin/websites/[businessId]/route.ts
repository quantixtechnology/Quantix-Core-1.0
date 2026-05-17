// ============================================================================
// Route: PUT /api/admin/websites/[businessId]
// Updates website settings for a business — branding, contact info, status, domain.
// ============================================================================

import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';

export const PUT = withMiddleware({
  requireAuth: true,
  requiredRoles: ['QUANTIX_SUPER_ADMIN', 'PLATFORM_ADMIN', 'DEPLOYMENT_TEAM'],
})(async (req, context) => {
  try {
    const params = await context?.params;
    const businessId = params?.businessId as string;
    if (!businessId) {
      return NextResponse.json({ success: false, error: 'businessId required' }, { status: 400 });
    }

    const body = (await req.json()) as {
      logo?: string | null;
      primaryColor?: string;
      secondaryColor?: string | null;
      accentColor?: string | null;
      contactPhone?: string | null;
      contactEmail?: string | null;
      address?: string | null;
      city?: string | null;
      state?: string | null;
      pincode?: string | null;
      websiteStatus?: 'active' | 'draft' | 'maintenance';
      customDomain?: string | null;
    };

    const business = await db.business.findUnique({
      where: { id: businessId },
      select: { id: true, slug: true, settings: true },
    });
    if (!business) {
      return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 });
    }

    // Parse current settings JSON
    let settings: Record<string, unknown> = {};
    try { settings = JSON.parse(business.settings || '{}'); } catch { /* ignore */ }
    const storefront = ((settings.storefront ?? {}) as Record<string, unknown>);

    const businessUpdate: Record<string, unknown> = {};

    // Branding
    if (body.logo !== undefined) businessUpdate.logo = body.logo;
    if (body.primaryColor !== undefined) businessUpdate.primaryColor = body.primaryColor;
    if (body.secondaryColor !== undefined) businessUpdate.secondaryColor = body.secondaryColor;

    // Contact
    if (body.contactPhone !== undefined) businessUpdate.contactPhone = body.contactPhone;
    if (body.contactEmail !== undefined) businessUpdate.contactEmail = body.contactEmail;
    if (body.address !== undefined) businessUpdate.address = body.address;
    if (body.city !== undefined) businessUpdate.city = body.city;
    if (body.state !== undefined) businessUpdate.state = body.state;
    if (body.pincode !== undefined) businessUpdate.pincode = body.pincode;

    // Website status maps to isOnline + storefront.websiteStatus
    if (body.websiteStatus !== undefined) {
      if (body.websiteStatus === 'active') {
        businessUpdate.isOnline = true;
        storefront.websiteStatus = 'active';
      } else if (body.websiteStatus === 'draft') {
        businessUpdate.isOnline = false;
        storefront.websiteStatus = 'draft';
      } else if (body.websiteStatus === 'maintenance') {
        businessUpdate.isOnline = false;
        storefront.websiteStatus = 'maintenance';
      }
    }

    // Accent color stored in settings
    if (body.accentColor !== undefined) {
      storefront.accentColor = body.accentColor;
    }

    settings.storefront = storefront;
    businessUpdate.settings = JSON.stringify(settings);

    await db.business.update({ where: { id: businessId }, data: businessUpdate });

    // Custom domain update
    if (body.customDomain !== undefined) {
      const storefrontBase = process.env.NEXT_PUBLIC_STOREFRONT_DOMAIN || 'quantixshop.in';
      const newDomain = body.customDomain || `${business.slug}.${storefrontBase}`;

      if (body.customDomain) {
        const collision = await db.domainMapping.findUnique({ where: { domain: body.customDomain } });
        if (collision && collision.businessId !== businessId) {
          return NextResponse.json(
            { success: false, error: `Domain "${body.customDomain}" is already mapped to another business` },
            { status: 409 }
          );
        }
      }

      await db.domainMapping.upsert({
        where: { businessId },
        create: {
          businessId,
          domain: newDomain,
          subdomain: business.slug,
          status: body.customDomain ? 'PENDING_DNS' : 'ACTIVE',
          sslStatus: 'pending',
        },
        update: {
          domain: newDomain,
          status: body.customDomain ? 'PENDING_DNS' : 'ACTIVE',
        },
      });
    }

    return NextResponse.json({ success: true, message: 'Website settings updated' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update website';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
