// ============================================================================
// QUANTIX CORE — Store Context + Theme API
// GET /api/core/storefront/store-context
//
// Public endpoint — no auth required.
// Called by customer storefront on page load to hydrate:
//   • Business branding (logo, colors, theme config from Business.settings)
//   • Active store details (operating hours, delivery config)
//   • Payment gateway availability
//
// Resolution order:
//   1. storeId param (direct)
//   2. businessId param + main store
//   3. slug param → business → main store
//   4. Host header (subdomain) → DomainMapping → business → main store
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveImageUrl } from '@/lib/image-url';
import { type OrderStage, getDefaultStages } from '@/lib/order-stages';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId');
    const businessId = searchParams.get('businessId');
    const slug = searchParams.get('slug');

    // --- Resolve business from various entry points ---

    let resolvedBusinessId: string | null = businessId;

    // Resolve from slug if no businessId
    if (!resolvedBusinessId && slug) {
      const biz = await db.business.findUnique({
        where: { slug },
        select: { id: true, status: true },
      });
      if (!biz || (biz.status !== 'ACTIVE' && biz.status !== 'ONBOARDING')) {
        return NextResponse.json(
          { success: false, error: 'Business not found' },
          { status: 404 }
        );
      }
      resolvedBusinessId = biz.id;
    }

    // Resolve from Host header (subdomain: slug.quantixtechnology.in)
    if (!resolvedBusinessId) {
      const host = request.headers.get('host') || '';
      const storefrontBaseDomain = process.env.NEXT_PUBLIC_STOREFRONT_DOMAIN || 'quantixtechnology.in';
      const subdomainMatch = host.replace(`.${storefrontBaseDomain}`, '');
      if (subdomainMatch && subdomainMatch !== host) {
        // subdomainMatch is the slug
        const mapping = await db.domainMapping.findFirst({
          where: {
            OR: [
              { domain: host },
              { subdomain: subdomainMatch },
            ],
          },
          select: { businessId: true },
        });
        if (mapping) {
          resolvedBusinessId = mapping.businessId;
        }
      }
    }

    if (!resolvedBusinessId) {
      return NextResponse.json(
        { success: false, error: 'Could not resolve business. Provide businessId, slug, or valid subdomain.' },
        { status: 400 }
      );
    }

    // --- Load business with branding and subscription ---

    const business = await db.business.findUnique({
      where: { id: resolvedBusinessId },
      select: {
        id: true,
        name: true,
        slug: true,
        businessType: true,
        status: true,
        isOnline: true,
        logo: true,
        favicon: true,
        primaryColor: true,
        secondaryColor: true,
        darkMode: true,
        tagline: true,
        description: true,
        contactEmail: true,
        contactPhone: true,
        supportEmail: true,
        supportPhone: true,
        settings: true,
        domain: {
          select: { domain: true, subdomain: true, status: true },
        },
        // Fetch BusinessBranding as fallback for logo/favicon if Business fields are null
        businessBranding: {
          select: { logo: true, favicon: true, primaryColor: true, darkMode: true },
        },
      },
    });

    if (!business) {
      return NextResponse.json(
        { success: false, error: 'Business not found' },
        { status: 404 }
      );
    }

    if (business.status !== 'ACTIVE' && business.status !== 'ONBOARDING') {
      return NextResponse.json(
        { success: false, error: 'Business is not active' },
        { status: 403 }
      );
    }

    // Parse settings JSON — contains ecommerceConfig initialized at business creation
    let parsedSettings: Record<string, unknown> = {};
    try {
      parsedSettings = JSON.parse(business.settings || '{}') as Record<string, unknown>;
    } catch {
      parsedSettings = {};
    }

    const ecommerceConfig = (parsedSettings.ecommerceConfig as Record<string, unknown>) || {
      banners: [],
      theme: 'default',
      homepageStyle: 'grid',
      font: 'inter',
    };
    const allowGuestCheckout = parsedSettings.allowGuestCheckout !== false; // default true

    const savedStages = parsedSettings.orderStageConfig as OrderStage[] | undefined
    const orderStages = savedStages && savedStages.length > 0
      ? savedStages
      : getDefaultStages(business.businessType)

    // --- Resolve store ---

    let resolvedStore;
    if (storeId) {
      resolvedStore = await db.store.findFirst({
        where: { id: storeId, businessId: resolvedBusinessId, status: 'ACTIVE' },
        include: { storeTimings: { orderBy: { day: 'asc' } } },
      });
    }

    // Fallback to main store if no storeId provided or storeId not found
    if (!resolvedStore) {
      resolvedStore = await db.store.findFirst({
        where: { businessId: resolvedBusinessId, status: 'ACTIVE', isMainStore: true },
        include: { storeTimings: { orderBy: { day: 'asc' } } },
      });
    }

    // Last resort: any active store
    if (!resolvedStore) {
      resolvedStore = await db.store.findFirst({
        where: { businessId: resolvedBusinessId, status: 'ACTIVE' },
        include: { storeTimings: { orderBy: { day: 'asc' } } },
      });
    }

    // --- Load active payment gateways for checkout ---

    const paymentGateways = await db.paymentGateway.findMany({
      where: { businessId: resolvedBusinessId, isActive: true },
      select: {
        id: true,
        name: true,
        gateway: true,
        isTestMode: true,
      },
    });

    // --- Build response ---

    return NextResponse.json({
      success: true,
      data: {
        business: {
          id: business.id,
          name: business.name,
          slug: business.slug,
          businessType: business.businessType,
          isOnline: business.isOnline,
          logo:    resolveImageUrl(business.logo    ?? business.businessBranding?.logo),
          favicon: resolveImageUrl(business.favicon ?? business.businessBranding?.favicon),
          primaryColor: business.primaryColor,
          secondaryColor: business.secondaryColor,
          darkMode: business.darkMode,
          tagline: business.tagline,
          description: business.description,
          contactEmail: business.contactEmail,
          contactPhone: business.contactPhone,
          supportEmail: business.supportEmail,
          supportPhone: business.supportPhone,
          domain: business.domain,
        },
        ecommerceConfig,
        allowGuestCheckout,
        orderStages,
        store: resolvedStore
          ? {
              id: resolvedStore.id,
              name: resolvedStore.name,
              slug: resolvedStore.slug,
              address: resolvedStore.address,
              city: resolvedStore.city,
              state: resolvedStore.state,
              pincode: resolvedStore.pincode,
              phone: resolvedStore.phone,
              email: resolvedStore.email,
              latitude: resolvedStore.latitude,
              longitude: resolvedStore.longitude,
              deliveryRadius: resolvedStore.deliveryRadius,
              deliveryFee: resolvedStore.deliveryFee,
              freeDeliveryAbove: resolvedStore.freeDeliveryAbove,
              minOrderAmount: resolvedStore.minOrderAmount,
              preparationTime: resolvedStore.preparationTime,
              isMainStore: resolvedStore.isMainStore,
              operatingHours: JSON.parse(resolvedStore.operatingHours || '{}'),
              storeTimings: resolvedStore.storeTimings,
            }
          : null,
        paymentGateways,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load store context';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
