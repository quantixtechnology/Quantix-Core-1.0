import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const businessType = searchParams.get('businessType');
    const search = searchParams.get('search');

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (businessType) where.businessType = businessType;
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
        include: {
          businessSubscription: { include: { plan: true } },
          domain: true,
          salesRep: { select: { id: true, name: true } },
          _count: { select: { stores: true, products: true, orders: true, customers: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.business.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: businesses,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Get businesses error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch businesses' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name, slug, businessType, tagline, description,
      logo, favicon, primaryColor, secondaryColor, darkMode,
      gstNumber, panNumber, cinNumber, fssaiLicense,
      address, city, state, pincode, country, latitude, longitude,
      contactEmail, contactPhone, supportEmail, supportPhone,
      defaultCurrency, defaultLocale, timezone,
      settings, features, notificationConfig,
      salesRepId, planId, billingCycle,
    } = body;

    if (!name || !slug || !businessType) {
      return NextResponse.json(
        { success: false, error: 'Name, slug, and businessType are required' },
        { status: 400 }
      );
    }

    // Check slug uniqueness
    const existing = await db.business.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Business slug already exists' },
        { status: 409 }
      );
    }

    const business = await db.business.create({
      data: {
        platformId: 'platform_1',
        name,
        slug,
        businessType,
        tagline,
        description,
        logo,
        favicon,
        primaryColor: primaryColor || '#10B981',
        secondaryColor,
        darkMode: darkMode ?? false,
        gstNumber,
        panNumber,
        cinNumber,
        fssaiLicense,
        address,
        city,
        state,
        pincode,
        country: country || 'India',
        latitude: latitude ? parseFloat(String(latitude)) : undefined,
        longitude: longitude ? parseFloat(String(longitude)) : undefined,
        contactEmail,
        contactPhone,
        supportEmail,
        supportPhone,
        defaultCurrency: defaultCurrency || 'INR',
        defaultLocale: defaultLocale || 'en-IN',
        timezone: timezone || 'Asia/Kolkata',
        settings: settings ? JSON.stringify(settings) : '{}',
        features: features ? JSON.stringify(features) : '{}',
        notificationConfig: notificationConfig ? JSON.stringify(notificationConfig) : '{}',
        salesRepId,
        status: 'ONBOARDING',
      },
    });

    // Create subscription if planId provided
    if (planId) {
      const plan = await db.platformPlan.findUnique({ where: { id: planId } });
      if (plan) {
        const now = new Date();
        const periodEnd = new Date(now);
        periodEnd.setMonth(periodEnd.getMonth() + (billingCycle === 'yearly' ? 12 : 1));

        await db.businessSubscription.create({
          data: {
            businessId: business.id,
            planId: plan.id,
            status: 'TRIAL',
            planPrice: plan.monthlyPrice,
            billingCycle: billingCycle || 'monthly',
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            nextBillingDate: periodEnd,
            trialStart: now,
            trialEnd: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000), // 14-day trial
          },
        });

        await db.business.update({
          where: { id: business.id },
          data: {
            status: 'TRIAL',
            trialStartsAt: now,
            trialEndsAt: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
          },
        });
      }
    }

    const result = await db.business.findUnique({
      where: { id: business.id },
      include: { businessSubscription: { include: { plan: true } } },
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    console.error('Create business error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create business' },
      { status: 500 }
    );
  }
}
