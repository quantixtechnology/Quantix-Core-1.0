import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withBusinessAccess, parsePagination, paginatedResponse, validateBusinessExists } from '@/lib/api-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  const { businessId } = await params;
  if (!(await validateBusinessExists(businessId))) {
    return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 });
  }
  return withBusinessAccess(request, businessId, async () => {
    try {
      const { page, limit, skip, search } = parsePagination(request);
      const { searchParams } = new URL(request.url);
      const type = searchParams.get('type');

      const where: Record<string, unknown> = { businessId, isActive: true };
      if (search) {
        where.OR = [{ name: { contains: search } }, { slug: { contains: search } }];
      }
      if (type) where.type = type;

      const [plans, total] = await Promise.all([
        db.subscriptionPlan.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
          include: {
            _count: { select: { subscriptions: true, planItems: true } },
          },
        }),
        db.subscriptionPlan.count({ where }),
      ]);

      return NextResponse.json({
        success: true,
        data: paginatedResponse(plans, total, page, limit),
      });
    } catch (error) {
      console.error('List subscription plans error:', error);
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  const { businessId } = await params;
  if (!(await validateBusinessExists(businessId))) {
    return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 });
  }
  return withBusinessAccess(request, businessId, async (_req, user) => {
    try {
      const bu = user.businessUsers.find(b => b.businessId === businessId);
      if (!bu || (bu.role !== 'SUPER_ADMIN' && bu.role !== 'BUSINESS_OWNER' && bu.role !== 'BUSINESS_ADMIN')) {
        return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
      }

      const body = await request.json();
      const {
        name, slug, description, type, billingCycle, price, originalPrice,
        setupFee, trialDays, totalCredits, creditLabel, features,
        isFeatured, maxSubscribers, sortOrder, startsAt, endsAt,
        planItems,
      } = body;

      if (!name || !slug || !type || !billingCycle || price === undefined) {
        return NextResponse.json({ success: false, error: 'Name, slug, type, billingCycle, and price are required' }, { status: 400 });
      }

      const existing = await db.subscriptionPlan.findUnique({ where: { businessId_slug: { businessId, slug } } });
      if (existing) {
        return NextResponse.json({ success: false, error: 'Plan slug already exists' }, { status: 409 });
      }

      const plan = await db.subscriptionPlan.create({
        data: {
          businessId,
          name,
          slug,
          description,
          type,
          billingCycle,
          price,
          originalPrice,
          setupFee: setupFee || 0,
          trialDays: trialDays || 0,
          totalCredits: totalCredits || 0,
          creditLabel,
          features: features ? JSON.stringify(features) : '[]',
          isFeatured: isFeatured || false,
          maxSubscribers,
          sortOrder: sortOrder || 0,
          startsAt: startsAt ? new Date(startsAt) : null,
          endsAt: endsAt ? new Date(endsAt) : null,
          planItems: planItems ? {
            create: planItems.map((item: Record<string, unknown>) => ({
              productId: item.productId as string | null,
              serviceName: item.serviceName as string | null,
              creditsPerCycle: (item.creditsPerCycle as number) || 1,
              maxPerUse: (item.maxPerUse as number) || 1,
              rollover: (item.rollover as boolean) || false,
              rolloverMax: (item.rolloverMax as number) || 0,
            })),
          } : undefined,
        },
        include: { planItems: true },
      });

      return NextResponse.json(
        { success: true, data: plan, message: 'Subscription plan created' },
        { status: 201 }
      );
    } catch (error) {
      console.error('Create subscription plan error:', error);
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  });
}
