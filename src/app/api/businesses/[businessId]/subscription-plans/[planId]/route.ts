import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withBusinessAccess, validateBusinessExists } from '@/lib/api-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string; planId: string }> }
) {
  const { businessId, planId } = await params;
  if (!(await validateBusinessExists(businessId))) {
    return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 });
  }
  return withBusinessAccess(request, businessId, async () => {
    try {
      const plan = await db.subscriptionPlan.findFirst({
        where: { id: planId, businessId },
        include: {
          planItems: { include: { product: { select: { id: true, name: true } } } },
          _count: { select: { subscriptions: true } },
        },
      });

      if (!plan) {
        return NextResponse.json({ success: false, error: 'Plan not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, data: plan });
    } catch (error) {
      console.error('Get subscription plan error:', error);
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string; planId: string }> }
) {
  const { businessId, planId } = await params;
  if (!(await validateBusinessExists(businessId))) {
    return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 });
  }
  return withBusinessAccess(request, businessId, async (_req, user) => {
    try {
      const bu = user.businessUsers.find(b => b.businessId === businessId);
      if (!bu || (bu.role !== 'SUPER_ADMIN' && bu.role !== 'BUSINESS_OWNER' && bu.role !== 'BUSINESS_ADMIN')) {
        return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
      }

      const plan = await db.subscriptionPlan.findFirst({ where: { id: planId, businessId } });
      if (!plan) {
        return NextResponse.json({ success: false, error: 'Plan not found' }, { status: 404 });
      }

      const body = await request.json();
      const allowedFields = [
        'name', 'description', 'price', 'originalPrice', 'setupFee', 'trialDays',
        'totalCredits', 'creditLabel', 'features', 'isFeatured', 'maxSubscribers',
        'sortOrder', 'isActive', 'startsAt', 'endsAt',
      ];

      const data: Record<string, unknown> = {};
      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          if (field === 'features') {
            data[field] = JSON.stringify(body[field]);
          } else if (field === 'startsAt' || field === 'endsAt') {
            data[field] = body[field] ? new Date(body[field] as string) : null;
          } else {
            data[field] = body[field];
          }
        }
      }

      const updated = await db.subscriptionPlan.update({
        where: { id: planId },
        data,
        include: { planItems: true },
      });

      return NextResponse.json({ success: true, data: updated, message: 'Plan updated' });
    } catch (error) {
      console.error('Update subscription plan error:', error);
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  });
}
