import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ businessId: string; subscriptionId: string }> }
) {
  try {
    const { businessId, subscriptionId } = await params;

    const subscription = await db.customerSubscription.findFirst({
      where: { id: subscriptionId, businessId },
      include: {
        customer: { select: { id: true, name: true, phone: true, email: true } },
        plan: { include: { planItems: true } },
        orders: { take: 10, orderBy: { createdAt: 'desc' } },
      },
    });

    if (!subscription) {
      return NextResponse.json(
        { success: false, error: 'Subscription not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: subscription });
  } catch (error) {
    console.error('Get subscription error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch subscription' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string; subscriptionId: string }> }
) {
  try {
    const { businessId, subscriptionId } = await params;
    const body = await request.json();

    const existing = await db.customerSubscription.findFirst({
      where: { id: subscriptionId, businessId },
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Subscription not found' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (body.status) updateData.status = body.status;
    if (body.usedCredits !== undefined) {
      updateData.usedCredits = body.usedCredits;
      updateData.remainingCredits = existing.totalCredits - body.usedCredits;
    }
    if (body.autoRenew !== undefined) updateData.autoRenew = body.autoRenew;

    if (body.action === 'pause') {
      updateData.status = 'PAUSED';
      updateData.pauseStartAt = new Date();
      if (body.pauseEndAt) updateData.pauseEndAt = new Date(body.pauseEndAt);
    }

    if (body.action === 'resume') {
      updateData.status = 'ACTIVE';
    }

    if (body.action === 'cancel') {
      updateData.status = 'CANCELLED';
      updateData.cancelledAt = new Date();
      updateData.cancelAtPeriodEnd = body.cancelAtPeriodEnd ?? false;
    }

    if (body.metadata) updateData.metadata = JSON.stringify(body.metadata);

    const subscription = await db.customerSubscription.update({
      where: { id: subscriptionId },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: subscription });
  } catch (error) {
    console.error('Update subscription error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update subscription' },
      { status: 500 }
    );
  }
}
