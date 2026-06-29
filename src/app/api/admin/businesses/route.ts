// ============================================================================
// Route: POST /api/admin/businesses — Create business (Onboarding)
// Route: GET /api/admin/businesses — List businesses (Admin panel)
// ============================================================================

import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { getReservedHostPrefixes } from '@/lib/product-hosts';

/**
 * POST /api/admin/businesses
 * Create a new business (called during onboarding)
 *
 * Accepts new payload format:
 * {
 *   businessName, slug, ownerName, email, phone,
 *   address1, address2, city, state, pincode, country
 * }
 *
 * businessType is NOT required - it comes from Product Selection
 * productCode is NOT required - it comes from Product Selection
 */
export const POST = withMiddleware({
  requireAuth: false,
})(async (req) => {
  try {
    const body = await req.json();

    // Accept both new and legacy payload formats
    const businessName = body.businessName || body.name;
    const slug = body.slug;
    const ownerName = body.ownerName;
    const email = body.email || body.contactEmail;
    const phone = body.phone || body.contactPhone;
    const address1 = body.address1 || body.address;
    const address2 = body.address2;
    const city = body.city;
    const state = body.state;
    const pincode = body.pincode || body.pinCode;
    const country = body.country || 'India';
    const businessType = body.businessType || 'GROCERY'; // Default to GROCERY if not provided

    // Validate required fields
    if (!businessName?.trim()) {
      return NextResponse.json(
        { success: false, message: 'Business name is required', field: 'businessName' },
        { status: 400 }
      );
    }

    if (!slug?.trim()) {
      return NextResponse.json(
        { success: false, message: 'Slug is required', field: 'slug' },
        { status: 400 }
      );
    }

    // A tenant slug becomes <slug>.<base>, so it must never collide with a
    // reserved platform/product subdomain (app, admin, commerce, laundry, …) —
    // otherwise the proxy would route that tenant's storefront to a product
    // workspace. Reserved set is registry-aligned (see src/lib/product-hosts.ts).
    if (getReservedHostPrefixes().includes(slug.toLowerCase().trim())) {
      return NextResponse.json(
        { success: false, message: 'This slug is reserved by the platform and cannot be used', field: 'slug', code: 'RESERVED_SLUG' },
        { status: 409 }
      );
    }

    if (!email?.trim()) {
      return NextResponse.json(
        { success: false, message: 'Email is required', field: 'email' },
        { status: 400 }
      );
    }

    if (!phone?.trim()) {
      return NextResponse.json(
        { success: false, message: 'Phone is required', field: 'phone' },
        { status: 400 }
      );
    }

    if (!address1?.trim()) {
      return NextResponse.json(
        { success: false, message: 'Address is required', field: 'address1' },
        { status: 400 }
      );
    }

    if (!city?.trim()) {
      return NextResponse.json(
        { success: false, message: 'City is required', field: 'city' },
        { status: 400 }
      );
    }

    if (!state?.trim()) {
      return NextResponse.json(
        { success: false, message: 'State is required', field: 'state' },
        { status: 400 }
      );
    }

    if (!pincode?.trim()) {
      return NextResponse.json(
        { success: false, message: 'PIN Code is required', field: 'pincode' },
        { status: 400 }
      );
    }

    // Check slug uniqueness
    const existingSlug = await db.business.findUnique({
      where: { slug: slug.toLowerCase() },
    });

    if (existingSlug) {
      return NextResponse.json(
        { success: false, message: 'Slug already exists', field: 'slug', code: 'DUPLICATE_SLUG' },
        { status: 409 }
      );
    }

    // Check email uniqueness if exists
    const existingEmail = await db.business.findFirst({
      where: { contactEmail: email.toLowerCase() },
    });

    if (existingEmail) {
      return NextResponse.json(
        { success: false, message: 'Email already exists', field: 'email', code: 'DUPLICATE_EMAIL' },
        { status: 409 }
      );
    }

    // Check phone uniqueness if exists
    const existingPhone = await db.business.findFirst({
      where: { contactPhone: phone },
    });

    if (existingPhone) {
      return NextResponse.json(
        { success: false, message: 'Phone already exists', field: 'phone', code: 'DUPLICATE_PHONE' },
        { status: 409 }
      );
    }

    // Create business with all provided information
    const business = await db.business.create({
      data: {
        name: businessName.trim(),
        slug: slug.toLowerCase().trim(),
        businessType,
        businessCode: `BIZ-${slug.toUpperCase()}-${Date.now()}`,
        address: address1.trim(),
        city: city.trim(),
        state: state.trim(),
        pincode: pincode.trim(),
        country: country || 'India',
        contactEmail: email.toLowerCase().trim(),
        contactPhone: phone.trim(),
        status: 'ONBOARDING',
        isOnline: false,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: business.id,
        name: business.name,
        slug: business.slug,
        status: business.status,
      },
    });
  } catch (error) {
    console.error('[admin/businesses POST] Error:', error);

    // Return complete Prisma error details for debugging
    let errorResponse: any = {
      success: false,
      message: 'Failed to create business',
    };

    if (error instanceof Error) {
      errorResponse.message = error.message;
    }

    // Include Prisma error details if available
    if ((error as any).code) {
      errorResponse.code = (error as any).code;
    }
    if ((error as any).meta) {
      errorResponse.meta = (error as any).meta;
    }

    // Determine HTTP status code and provide field-specific errors
    let statusCode = 500;
    if ((error as any).code === 'P2002') {
      // Unique constraint failed
      statusCode = 409;
      const target = (error as any).meta?.target?.[0];
      if (target === 'slug') {
        errorResponse.field = 'slug';
        errorResponse.message = 'Slug already exists';
        errorResponse.code = 'DUPLICATE_SLUG';
      } else if (target === 'contactEmail') {
        errorResponse.field = 'email';
        errorResponse.message = 'Email already exists';
        errorResponse.code = 'DUPLICATE_EMAIL';
      } else if (target === 'businessCode') {
        errorResponse.field = 'businessName';
        errorResponse.message = 'Business code conflict';
        errorResponse.code = 'DUPLICATE_BUSINESS_CODE';
      }
    } else if ((error as any).code === 'P2000') {
      // Value too long
      statusCode = 400;
      errorResponse.message = 'One or more fields exceed maximum length';
    } else if ((error as any).code === 'P2003') {
      // Foreign key constraint failed
      statusCode = 400;
      errorResponse.message = 'Invalid reference to another record';
    }

    return NextResponse.json(errorResponse, { status: statusCode });
  }
});

export const GET = withMiddleware({
  requireAuth: true,
  requiredPermission: 'businesses:view',
})(async (req) => {
  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const skip = (page - 1) * limit;

    // Filters
    const businessTypeParam = searchParams.get('businessType');
    const statusParam = searchParams.get('status');
    const search = searchParams.get('search') || undefined;
    const isOnlineParam = searchParams.get('isOnline');

    const where: Record<string, unknown> = {};

    if (businessTypeParam) {
      where.businessType = { in: businessTypeParam.split(',') };
    }

    if (statusParam) {
      where.status = { in: statusParam.split(',') };
    }

    if (isOnlineParam !== null) {
      where.isOnline = isOnlineParam === 'true';
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { slug: { contains: search } },
        { contactEmail: { contains: search } },
        { city: { contains: search } },
      ];
    }

    const [businesses, total] = await Promise.all([
      db.business.findMany({
        where,
        skip,
        take: limit,
        include: {
          businessSubscription: {
            include: {
              plan: { select: { name: true, tier: true } },
            },
          },
          domain: { select: { domain: true, status: true } },
          deployments: {
            select: { id: true, type: true, status: true, version: true, healthStatus: true },
          },
          modules: {
            select: { moduleKey: true, moduleName: true, status: true },
          },
          businessUsers: {
            where: { role: 'CLIENT_OWNER', isActive: true },
            include: {
              user: {
                select: { id: true, email: true, loginId: true, name: true, phone: true, lastLoginAt: true, isActive: true },
              },
            },
            take: 1,
          },
          salesRep: { select: { name: true } },
          stores: {
            where: { isMainStore: true },
            select: { id: true, storeCode: true },
            take: 1,
          },
          _count: {
            select: { stores: true, orders: true, customers: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.business.count({ where }),
    ]);

    // Compute order revenue for each business
    const businessIds = businesses.map((b) => b.id);
    const revenueByBusiness = await db.order.groupBy({
      by: ['businessId'],
      where: { businessId: { in: businessIds }, paymentStatus: 'COMPLETED' },
      _sum: { totalAmount: true },
    });

    const revenueMap = new Map<string, number>();
    for (const r of revenueByBusiness) {
      revenueMap.set(r.businessId, r._sum.totalAmount ?? 0);
    }

    // Serialize for the frontend
    const data = businesses.map((b) => ({
      id: b.id,
      businessCode: b.businessCode,
      name: b.name,
      slug: b.slug,
      businessType: b.businessType,
      status: b.status,
      // Lifecycle fields — drive onboarding resume state in the UI
      productCode: b.productCode,
      subscriptionPlanCode: b.subscriptionPlanCode,
      city: b.city,
      state: b.state,
      pincode: b.pincode,
      country: b.country,
      address: b.address,
      contactEmail: b.contactEmail,
      contactPhone: b.contactPhone,
      supportEmail: b.supportEmail,
      supportPhone: b.supportPhone,
      gstNumber: b.gstNumber,
      panNumber: b.panNumber,
      cinNumber: b.cinNumber,
      fssaiLicense: b.fssaiLicense,
      favicon: b.favicon,
      secondaryColor: b.secondaryColor,
      tagline: b.tagline,
      description: b.description,
      logo: b.logo,
      isOnline: b.isOnline,
      primaryColor: b.primaryColor,
      createdAt: b.createdAt,
      onboardedAt: b.onboardedAt,
      activatedAt: b.activatedAt,
      // Subscription info
      subscription: b.businessSubscription
        ? {
            id: b.businessSubscription.id,
            status: b.businessSubscription.status,
            // New billing fields
            subscriptionAmount: b.businessSubscription.subscriptionAmount,
            discountAmount: b.businessSubscription.discountAmount,
            finalAmount: b.businessSubscription.finalAmount,
            implementationAmount: b.businessSubscription.implementationAmount,
            iosAppAmount: b.businessSubscription.iosAppAmount,
            iosDiscountAmount: b.businessSubscription.iosDiscountAmount,
            iosFinalAmount: b.businessSubscription.iosFinalAmount,
            iosSubscriptionCycle: b.businessSubscription.iosSubscriptionCycle,
            addOns: b.businessSubscription.addOns,
            // Legacy
            planPrice: b.businessSubscription.planPrice,
            customPrice: b.businessSubscription.customPrice,
            discountPercentage: b.businessSubscription.discountPercentage,
            manualPriceOverride: b.businessSubscription.manualPriceOverride,
            overrideReason: b.businessSubscription.overrideReason,
            billingCycle: b.businessSubscription.billingCycle,
            billingCycleDay: b.businessSubscription.billingCycleDay,
            currentPeriodStart: b.businessSubscription.currentPeriodStart,
            nextBillingDate: b.businessSubscription.nextBillingDate,
            notes: b.businessSubscription.notes,
            plan: b.businessSubscription.plan
              ? {
                  name: b.businessSubscription.plan.name,
                  tier: b.businessSubscription.plan.tier,
                }
              : null,
          }
        : null,
      // Domain info
      domain: b.domain
        ? { domain: b.domain.domain, status: b.domain.status }
        : null,
      // Deployments
      deployments: b.deployments,
      // Modules
      modules: b.modules,
      // Sales rep
      salesRep: b.salesRep?.name || null,
      // Main store
      mainStore: b.stores[0]
        ? { id: b.stores[0].id, storeCode: b.stores[0].storeCode }
        : null,
      // Counts
      storeCount: b._count.stores,
      orderCount: b._count.orders,
      customerCount: b._count.customers,
      // Revenue
      totalRevenue: revenueMap.get(b.id) || 0,
      // Owner account (no internal IDs exposed)
      ownerLoginId: b.businessUsers[0]?.user.loginId ?? b.businessUsers[0]?.user.email ?? null,
      ownerEmail: b.businessUsers[0]?.user.email ?? null,
      ownerName: b.businessUsers[0]?.user.name ?? null,
      ownerPhone: b.businessUsers[0]?.user.phone ?? null,
      ownerLastLogin: b.businessUsers[0]?.user.lastLoginAt ?? null,
      ownerIsActive: b.businessUsers[0]?.user.isActive ?? null,
      ownerInternalId: b.businessUsers[0]?.user.id ?? null,
    }));

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error('[admin/businesses] Error:', error);
    return NextResponse.json(
      { success: false, error: `Failed to fetch businesses: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
});
