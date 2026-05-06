import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withBusinessAccess, validateBusinessExists } from '@/lib/api-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string; subscriptionId: string }> }
) {
  const { businessId, subscriptionId } = await params;
  if (!(await validateBusinessExists(businessId))) {
    return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 });
  }
  return withBusinessAccess(request, businessId, async () => {
    try {
      const subscription = await db.customerSubscription.findFirst({
        where: { id: subscriptionId, businessId },
        include: {
          customer: { select: { id: true, name: true, phone: true, email: true } },
          plan: {
            select: { id: true, name: true, type: true, billingCycle: true, price: true, totalCredits: true, creditLabel: true },
            include: { planItems: true },
          },
          usages: { take: 20, orderBy: { usedAt: 'desc' } },
          orders: { take: 10, orderBy: { createdAt: 'desc' }, select: { id: true, orderNumber: true, totalAmount: true, status: true, createdAt: true } },
          invoices: { take: 5, orderBy: { createdAt: 'desc' } },
        },
      });

      if (!subscription) {
        return NextResponse.json({ success: false, error: 'Subscription not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, data: subscription });
    } catch (error) {
      console.error('Get subscription error:', error);
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string; subscriptionId: string }> }
) {
  const { businessId, subscriptionId } = await params;
  if (!(await validateBusinessExists(businessId))) {
    return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 });
  }
  return withBusinessAccess(request, businessId, async (_req, user) => {
    try {
      const subscription = await db.customerSubscription.findFirst({ where: { id: subscriptionId, businessId } });
      if (!subscription) {
        return NextResponse.json({ success: false, error: 'Subscription not found' }, { status: 404 });
      }

      const body = await request.json();
      const { action } = body;

      let updateData: Record<string, unknown> = {};

      if (action === 'pause') {
        updateData = {
          status: 'PAUSED',
          pauseStartAt: body.pauseStartAt ? new Date(body.pauseStartAt) : new Date(),
          pauseEndAt: body.pauseEndAt ? new Date(body.pauseEndAt) : null,
        };
      } else if (action === 'resume') {
        updateData = {
          status: 'ACTIVE',
          pauseStartAt: null,
          pauseEndAt: null,
        };
      } else if (action === 'cancel') {
        updateData = {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelAtPeriodEnd: body.cancelAtPeriodEnd || false,
          autoRenew: false,
        };
        if (!body.cancelAtPeriodEnd) {
          // Immediate cancel
          updateData.remainingCredits = 0;
        }
      } else {
        // Generic update
        const allowedFields = ['autoRenew', 'cancelAtPeriodEnd'];
        for (const field of allowedFields) {
          if (body[field] !== undefined) {
            updateData[field] = body[field];
          }
        }
      }

      const updated = await db.customerSubscription.update({
        where: { id: subscriptionId },
        data: updateData,
        include: {
          customer: { select: { name: true } },
          plan: { select: { name: true } },
        },
      });

      // Log activity
      await db.activityLog.create({
        data: {
          businessId,
          userId: user.id,
          action: `subscription.${action || 'updated'}`,
          entity: 'CustomerSubscription',
          entityId: subscriptionId,
          details: JSON.stringify({ action, customerId: subscription.customerId }),
        },
      });

      return NextResponse.json({ success: true, data: updated, message: `Subscription ${action || 'updated'}` });
    } catch (error) {
      console.error('Update subscription error:', error);
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  });
}
