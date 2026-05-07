// ============================================================================
// QUANTIX CORE — Tenant Resolution API
// GET /api/core/tenant/resolve — Resolve business from domain/subdomain
// Returns business info + branding for the resolved tenant
// ============================================================================

import { NextResponse } from 'next/server';
import {
  resolveBusinessFromDomain,
  getBusinessBranding,
  isDomainMapped,
} from '@/lib/tenant-resolver';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const domain = searchParams.get('domain');
    const subdomain = searchParams.get('subdomain');
    const businessId = searchParams.get('businessId');

    // If a domain or subdomain is provided, resolve from it
    if (domain) {
      const resolved = await resolveBusinessFromDomain(domain);

      if (!resolved) {
        return NextResponse.json(
          {
            success: false,
            error: 'No business found for this domain',
            data: null,
          },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: resolved,
      });
    }

    // If a subdomain is provided, construct a hostname and resolve
    if (subdomain) {
      // Construct domain from subdomain (e.g., freshmart → freshmart.quantixtechnology.in)
      const constructedDomain = `${subdomain}.quantixtechnology.in`;
      const resolved = await resolveBusinessFromDomain(constructedDomain);

      if (!resolved) {
        return NextResponse.json(
          {
            success: false,
            error: 'No business found for this subdomain',
            data: null,
          },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: resolved,
      });
    }

    // If a businessId is provided, get branding directly
    if (businessId) {
      const branding = await getBusinessBranding(businessId);

      return NextResponse.json({
        success: true,
        data: {
          business: branding,
          domain: branding.domain
            ? {
                domain: branding.domain,
                subdomain: branding.subdomain,
                isPrimary: true,
                sslStatus: 'active',
                status: 'ACTIVE',
              }
            : null,
        },
      });
    }

    // If no parameters provided, try to resolve from the request hostname
    const requestHost = request.headers.get('host') || '';
    if (requestHost) {
      // Check if this is a custom domain (not the platform domain)
      const platformDomains = [
        'localhost',
        '127.0.0.1',
        'quantixtechnology.in',
        'www.quantixtechnology.in',
      ];

      const isPlatformDomain = platformDomains.some(
        (pd) => requestHost.startsWith(pd) || requestHost.startsWith(`www.${pd}`)
      );

      if (!isPlatformDomain) {
        const resolved = await resolveBusinessFromDomain(requestHost);
        if (resolved) {
          return NextResponse.json({
            success: true,
            data: resolved,
          });
        }
      }
    }

    return NextResponse.json(
      {
        success: false,
        error:
          'Provide a domain, subdomain, or businessId query parameter to resolve a tenant',
        data: null,
      },
      { status: 400 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to resolve tenant';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
