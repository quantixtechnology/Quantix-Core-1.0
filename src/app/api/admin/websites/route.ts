// ============================================================================
// Route: GET /api/admin/websites
// Returns all business website configs for the Website Management panel.
// Data comes from real Business + DomainMapping records — no mock data.
// ============================================================================

import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';

export const GET = withMiddleware({
  requireAuth: true,
  requiredPermission: 'platform:manage_domains',
})(async () => {
  try {
    const businesses = await db.business.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        businessType: true,
        status: true,
        isOnline: true,
        logo: true,
        primaryColor: true,
        secondaryColor: true,
        tagline: true,
        contactPhone: true,
        contactEmail: true,
        address: true,
        city: true,
        state: true,
        pincode: true,
        settings: true,
        updatedAt: true,
        domain: {
          select: {
            domain: true,
            subdomain: true,
            sslStatus: true,
            sslExpiryDate: true,
            status: true,
            configuredAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const data = businesses.map((b) => {
      let settings: Record<string, unknown> = {};
      try { settings = JSON.parse(b.settings || '{}'); } catch { /* ignore */ }
      const storefront = (settings.storefront as Record<string, unknown>) ?? {};

      // Derive website status from business state
      let websiteStatus = 'draft';
      if (b.status === 'SUSPENDED') {
        websiteStatus = 'suspended';
      } else if (storefront.websiteStatus === 'maintenance') {
        websiteStatus = 'maintenance';
      } else if (b.isOnline) {
        websiteStatus = 'active';
      }

      return {
        id: b.id,
        name: b.name,
        slug: b.slug,
        businessType: b.businessType,
        businessStatus: b.status,
        isOnline: b.isOnline,
        logo: b.logo,
        primaryColor: b.primaryColor,
        secondaryColor: b.secondaryColor,
        accentColor: (storefront.accentColor as string) ?? null,
        tagline: b.tagline,
        contactPhone: b.contactPhone,
        contactEmail: b.contactEmail,
        address: b.address,
        city: b.city,
        state: b.state,
        pincode: b.pincode,
        websiteStatus,
        websiteUrl: b.domain?.domain ?? null,
        subdomain: b.domain?.subdomain ?? null,
        sslStatus: b.domain?.sslStatus ?? 'pending',
        sslExpiryDate: b.domain?.sslExpiryDate ?? null,
        domainStatus: b.domain?.status ?? null,
        domainConfiguredAt: b.domain?.configuredAt ?? null,
        updatedAt: b.updatedAt,
      };
    });

    return NextResponse.json({ success: true, data, total: data.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch websites';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
