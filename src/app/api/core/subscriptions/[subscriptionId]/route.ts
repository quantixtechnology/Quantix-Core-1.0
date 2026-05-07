// ============================================================================
// QUANTIX CORE — Subscription Detail API
// GET  /api/core/subscriptions/[subscriptionId] — Get subscription details
// PUT  /api/core/subscriptions/[subscriptionId] — Update subscription (pause, resume, cancel)
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { pauseSubscription, resumeSubscription } from '@/lib/core/subscription';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ subscriptionId: string }> }
) {
  try {
    const { subscriptionId } = await params;

    const subscription = await db.customerSubscription.findUnique({
      where: { id: subscriptionId },
      include: {
        plan: {
          include: { planItems: true },
        },
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        usages: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!subscription) {
      return NextResponse.json(
        { success: false, error: 'Subscription not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: subscription,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get subscription';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ subscriptionId: string }> }
) {
  try {
    const { subscriptionId } = await params;
    const body = await request.json();

    if (!body.action) {
      return NextResponse.json(
        { success: false, error: 'action is required (pause, resume, cancel)' },
        { status: 400 }
      );
    }

    const validActions = ['pause', 'resume', 'cancel'];
    if (!validActions.includes(body.action)) {
      return NextResponse.json(
        { success: false, error: `action must be one of: ${validActions.join(', ')}` },
        { status: 400 }
      );
    }

    if (body.action === 'pause') {
      const pauseStart = body.pauseStart ? new Date(body.pauseStart) : new Date();
      const pauseEnd = body.pauseEnd ? new Date(body.pauseEnd) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // default 30 days

      const result = await pauseSubscription(subscriptionId, pauseStart, pauseEnd);

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        data: result.data,
        message: 'Subscription paused successfully',
      });
    }

    if (body.action === 'resume') {
      const result = await resumeSubscription(subscriptionId);

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        data: result.data,
        message: 'Subscription resumed successfully',
      });
    }

    if (body.action === 'cancel') {
      const subscription = await db.customerSubscription.findUnique({
        where: { id: subscriptionId },
      });

      if (!subscription) {
        return NextResponse.json(
          { success: false, error: 'Subscription not found' },
          { status: 404 }
        );
      }

      if (subscription.status === 'CANCELLED') {
        return NextResponse.json(
          { success: false, error: 'Subscription is already cancelled' },
          { status: 400 }
        );
      }

      const updated = await db.customerSubscription.update({
        where: { id: subscriptionId },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelAtPeriodEnd: body.cancelAtPeriodEnd || false,
          autoRenew: false,
        },
      });

      // Update plan subscriber count
      await db.subscriptionPlan.update({
        where: { id: subscription.planId },
        data: { currentSubscribers: { decrement: 1 } },
      });

      return NextResponse.json({
        success: true,
        data: updated,
        message: 'Subscription cancelled successfully',
      });
    }

    return NextResponse.json(
      { success: false, error: 'Unknown action' },
      { status: 400 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update subscription';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
