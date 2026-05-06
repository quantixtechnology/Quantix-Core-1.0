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
      const status = searchParams.get('status');
      const customerId = searchParams.get('customerId');

      const where: Record<string, unknown> = { businessId };
      if (status) where.status = status;
      if (customerId) where.customerId = customerId;
      if (search) {
        where.OR = [
          { customer: { name: { contains: search } } },
          { plan: { name: { contains: search } } },
        ];
      }

      const [subscriptions, total] = await Promise.all([
        db.customerSubscription.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            customer: { select: { id: true, name: true, phone: true, email: true } },
            plan: { select: { id: true, name: true, type: true, billingCycle: true, price: true } },
            _count: { select: { usages: true, orders: true } },
          },
        }),
        db.customerSubscription.count({ where }),
      ]);

      return NextResponse.json({
        success: true,
        data: paginatedResponse(subscriptions, total, page, limit),
      });
    } catch (error) {
      console.error('List subscriptions error:', error);
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
  return withBusinessAccess(request, businessId, async () => {
    try {
      const body = await request.json();
      const { customerId, planId, autoRenew } = body;

      if (!customerId || !planId) {
        return NextResponse.json({ success: false, error: 'Customer ID and Plan ID are required' }, { status: 400 });
      }

      const customer = await db.customer.findFirst({ where: { id: customerId, businessId } });
      if (!customer) {
        return NextResponse.json({ success: false, error: 'Customer not found' }, { status: 404 });
      }

      const plan = await db.subscriptionPlan.findFirst({ where: { id: planId, businessId, isActive: true } });
      if (!plan) {
        return NextResponse.json({ success: false, error: 'Plan not found or inactive' }, { status: 404 });
      }

      // Calculate period dates
      const now = new Date();
      const periodStart = new Date(now);
      let periodEnd = new Date(now);

      switch (plan.billingCycle) {
        case 'DAILY': periodEnd.setDate(periodEnd.getDate() + 1); break;
        case 'WEEKLY': periodEnd.setDate(periodEnd.getDate() + 7); break;
        case 'BIWEEKLY': periodEnd.setDate(periodEnd.getDate() + 14); break;
        case 'MONTHLY': periodEnd.setMonth(periodEnd.getMonth() + 1); break;
        case 'QUARTERLY': periodEnd.setMonth(periodEnd.getMonth() + 3); break;
        case 'HALF_YEARLY': periodEnd.setMonth(periodEnd.getMonth() + 6); break;
        case 'YEARLY': periodEnd.setFullYear(periodEnd.getFullYear() + 1); break;
      }

      const subscription = await db.customerSubscription.create({
        data: {
          businessId,
          customerId,
          planId,
          status: 'ACTIVE',
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          nextBillingDate: periodEnd,
          totalCredits: plan.totalCredits,
          usedCredits: 0,
          remainingCredits: plan.totalCredits,
          autoRenew: autoRenew !== undefined ? autoRenew : true,
          lastPaymentAmount: plan.price,
          lastPaymentAt: new Date(),
        },
        include: {
          customer: { select: { name: true, phone: true } },
          plan: { select: { name: true, type: true, billingCycle: true } },
        },
      });

      // Update plan subscriber count
      await db.subscriptionPlan.update({
        where: { id: planId },
        data: { currentSubscribers: { increment: 1 } },
      });

      return NextResponse.json(
        { success: true, data: subscription, message: 'Customer subscribed successfully' },
        { status: 201 }
      );
    } catch (error) {
      console.error('Create subscription error:', error);
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  });
}
