// ============================================================================
// QUANTIX CORE — Tenant Resolution Utility
// Resolve business from domain/hostname, get branding, check domain mapping
// Used by tenant API route and frontend hooks for multi-tenant routing
// ============================================================================

import { db } from '@/lib/db';

// ============================================================================
// Types
// ============================================================================

export interface BusinessBranding {
  businessId: string;
  businessName: string;
  businessType: string;
  slug: string;
  logo: string | null;
  favicon: string | null;
  primaryColor: string;
  secondaryColor: string | null;
  darkMode: boolean;
  tagline: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string;
  contactEmail: string | null;
  contactPhone: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  website: string | null;
  status: string;
  domain: string | null;
  subdomain: string | null;
}

export interface ResolvedTenant {
  business: BusinessBranding;
  domain: {
    domain: string;
    subdomain: string | null;
    isPrimary: boolean;
    sslStatus: string;
    status: string;
  };
}

// ============================================================================
// Resolve Business from Domain/Hostname
// ============================================================================

/**
 * Resolve a business from a domain name or hostname.
 * Checks DomainMapping table for the domain, then returns the business
 * with its branding information.
 *
 * Resolution order:
 * 1. Exact domain match in DomainMapping
 * 2. Subdomain match (e.g., freshmart.quantixtechnology.in)
 * 3. Returns null if no match found
 *
 * @param hostname - The domain/hostname to resolve (e.g., 'freshmart.com' or 'freshmart.quantixtechnology.in')
 * @returns Business branding info or null if not found
 */
export async function resolveBusinessFromDomain(
  hostname: string
): Promise<ResolvedTenant | null> {
  if (!hostname) return null;

  // Normalize: remove port, protocol, trailing slashes
  const cleanHostname = hostname
    .replace(/^https?:\/\//, '')
    .replace(/:\d+$/, '')
    .replace(/\/+$/, '')
    .toLowerCase();

  // Try exact domain match first
  const domainMapping = await db.domainMapping.findFirst({
    where: {
      OR: [
        { domain: cleanHostname },
        { subdomain: cleanHostname.split('.')[0] },
      ],
    },
    include: {
      business: {
        select: {
          id: true,
          name: true,
          businessType: true,
          slug: true,
          logo: true,
          favicon: true,
          primaryColor: true,
          secondaryColor: true,
          darkMode: true,
          tagline: true,
          address: true,
          city: true,
          state: true,
          country: true,
          contactEmail: true,
          contactPhone: true,
          supportEmail: true,
          supportPhone: true,
          status: true,
          settings: true,
        },
      },
    },
  });

  if (!domainMapping || !domainMapping.business) {
    return null;
  }

  const business = domainMapping.business;

  // Parse settings JSON for website
  let website: string | null = null;
  try {
    const settings = JSON.parse(business.settings || '{}');
    website = settings.website || null;
  } catch {
    // Ignore parse errors
  }

  const branding: BusinessBranding = {
    businessId: business.id,
    businessName: business.name,
    businessType: business.businessType,
    slug: business.slug,
    logo: business.logo,
    favicon: business.favicon,
    primaryColor: business.primaryColor,
    secondaryColor: business.secondaryColor,
    darkMode: business.darkMode,
    tagline: business.tagline,
    address: business.address,
    city: business.city,
    state: business.state,
    country: business.country,
    contactEmail: business.contactEmail,
    contactPhone: business.contactPhone,
    supportEmail: business.supportEmail,
    supportPhone: business.supportPhone,
    website,
    status: business.status,
    domain: domainMapping.domain,
    subdomain: domainMapping.subdomain,
  };

  return {
    business: branding,
    domain: {
      domain: domainMapping.domain,
      subdomain: domainMapping.subdomain,
      isPrimary: domainMapping.isPrimary,
      sslStatus: domainMapping.sslStatus,
      status: domainMapping.status,
    },
  };
}

// ============================================================================
// Get Business Branding
// ============================================================================

/**
 * Get branding information for a business by its ID.
 * Returns colors, logo, name, and other branding data.
 *
 * @param businessId - The business ID
 * @returns Business branding info or default values
 */
export async function getBusinessBranding(
  businessId: string
): Promise<BusinessBranding> {
  const business = await db.business.findUnique({
    where: { id: businessId },
    select: {
      id: true,
      name: true,
      businessType: true,
      slug: true,
      logo: true,
      favicon: true,
      primaryColor: true,
      secondaryColor: true,
      darkMode: true,
      tagline: true,
      address: true,
      city: true,
      state: true,
      country: true,
      contactEmail: true,
      contactPhone: true,
      supportEmail: true,
      supportPhone: true,
      status: true,
      settings: true,
    },
  });

  if (!business) {
    // Return default branding
    return {
      businessId,
      businessName: 'Quantix Store',
      businessType: 'GROCERY',
      slug: 'default',
      logo: null,
      favicon: null,
      primaryColor: '#10B981',
      secondaryColor: null,
      darkMode: false,
      tagline: null,
      address: null,
      city: null,
      state: null,
      country: 'India',
      contactEmail: null,
      contactPhone: null,
      supportEmail: null,
      supportPhone: null,
      website: null,
      status: 'ACTIVE',
      domain: null,
      subdomain: null,
    };
  }

  // Parse settings JSON for website
  let website: string | null = null;
  try {
    const settings = JSON.parse(business.settings || '{}');
    website = settings.website || null;
  } catch {
    // Ignore parse errors
  }

  // Also check domain mapping
  const domainMapping = await db.domainMapping.findFirst({
    where: { businessId },
  });

  return {
    businessId: business.id,
    businessName: business.name,
    businessType: business.businessType,
    slug: business.slug,
    logo: business.logo,
    favicon: business.favicon,
    primaryColor: business.primaryColor,
    secondaryColor: business.secondaryColor,
    darkMode: business.darkMode,
    tagline: business.tagline,
    address: business.address,
    city: business.city,
    state: business.state,
    country: business.country,
    contactEmail: business.contactEmail,
    contactPhone: business.contactPhone,
    supportEmail: business.supportEmail,
    supportPhone: business.supportPhone,
    website,
    status: business.status,
    domain: domainMapping?.domain || null,
    subdomain: domainMapping?.subdomain || null,
  };
}

// ============================================================================
// Check if Domain is Mapped
// ============================================================================

/**
 * Check if a domain is mapped to a business.
 *
 * @param domain - The domain to check
 * @returns true if the domain is mapped to a business
 */
export async function isDomainMapped(domain: string): Promise<boolean> {
  if (!domain) return false;

  const cleanDomain = domain
    .replace(/^https?:\/\//, '')
    .replace(/:\d+$/, '')
    .replace(/\/+$/, '')
    .toLowerCase();

  const count = await db.domainMapping.count({
    where: {
      OR: [{ domain: cleanDomain }, { subdomain: cleanDomain.split('.')[0] }],
    },
  });

  return count > 0;
}
