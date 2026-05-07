// ============================================================================
// QUANTIX CORE — Subscription Plans API
// GET  /api/core/subscriptions/plans  — List subscription plans for a business
// POST /api/core/subscriptions/plans  — Create subscription plan (customer-facing plans)
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');

    if (!businessId) {
      return NextResponse.json(
        { success: false, error: 'businessId is required' },
        { status: 400 }
      );
    }

    const serviceType = searchParams.get('serviceType');
    const isActive = searchParams.get('isActive');

    const where: Record<string, unknown> = {
      businessId,
      ...(serviceType && { serviceType }),
      ...(isActive !== null && { isActive: isActive !== 'false' }),
    };

    const plans = await db.subscriptionPlan.findMany({
      where,
      include: { planItems: true },
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json({
      success: true,
      data: plans,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list subscription plans';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.businessId) {
      return NextResponse.json(
        { success: false, error: 'businessId is required' },
        { status: 400 }
      );
    }
    if (!body.name) {
      return NextResponse.json(
        { success: false, error: 'name is required' },
        { status: 400 }
      );
    }
    if (!body.slug) {
      return NextResponse.json(
        { success: false, error: 'slug is required' },
        { status: 400 }
      );
    }
    if (!body.serviceType) {
      return NextResponse.json(
        { success: false, error: 'serviceType is required' },
        { status: 400 }
      );
    }
    if (!body.billingCycle) {
      return NextResponse.json(
        { success: false, error: 'billingCycle is required' },
        { status: 400 }
      );
    }
    if (body.price === undefined || body.price === null || body.price < 0) {
      return NextResponse.json(
        { success: false, error: 'price must be non-negative' },
        { status: 400 }
      );
    }

    // Check for duplicate slug within business
    const existing = await db.subscriptionPlan.findUnique({
      where: {
        businessId_slug: {
          businessId: body.businessId,
          slug: body.slug,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'A plan with this slug already exists for this business' },
        { status: 400 }
      );
    }

    const plan = await db.subscriptionPlan.create({
      data: {
        businessId: body.businessId,
        name: body.name,
        slug: body.slug,
        description: body.description,
        serviceType: body.serviceType,
        billingCycle: body.billingCycle,
        price: body.price,
        originalPrice: body.originalPrice,
        setupFee: body.setupFee || 0,
        trialDays: body.trialDays || 0,
        totalCredits: body.totalCredits || 0,
        creditLabel: body.creditLabel,
        features: typeof body.features === 'object' ? JSON.stringify(body.features) : (body.features || '[]'),
        isFeatured: body.isFeatured || false,
        maxSubscribers: body.maxSubscribers,
        isActive: body.isActive !== false,
        sortOrder: body.sortOrder || 0,
        startsAt: body.startsAt ? new Date(body.startsAt) : undefined,
        endsAt: body.endsAt ? new Date(body.endsAt) : undefined,
      },
    });

    // Create plan items if provided
    if (body.items && Array.isArray(body.items) && body.items.length > 0) {
      await db.subscriptionPlanItem.createMany({
        data: body.items.map((item: Record<string, unknown>) => ({
          planId: plan.id,
          productId: item.productId as string | undefined,
          serviceName: item.serviceName as string | undefined,
          creditsPerCycle: (item.creditsPerCycle as number) || 1,
          maxPerUse: (item.maxPerUse as number) || 1,
          rollover: (item.rollover as boolean) || false,
          rolloverMax: (item.rolloverMax as number) || 0,
        })),
      });
    }

    // Return with plan items
    const result = await db.subscriptionPlan.findUnique({
      where: { id: plan.id },
      include: { planItems: true },
    });

    return NextResponse.json({
      success: true,
      data: result,
      message: 'Subscription plan created successfully',
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create subscription plan';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
