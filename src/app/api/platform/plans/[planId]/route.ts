import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ planId: string }> }
) {
  try {
    const { planId } = await params;
    const plan = await db.platformPlan.findUnique({ where: { id: planId } });

    if (!plan) {
      return NextResponse.json(
        { success: false, error: 'Plan not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: plan });
  } catch (error) {
    console.error('Get plan error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch plan' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ planId: string }> }
) {
  try {
    const { planId } = await params;
    const body = await request.json();

    const existing = await db.platformPlan.findUnique({ where: { id: planId } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Plan not found' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    const allowedFields = [
      'name', 'tier', 'monthlyPrice', 'yearlyPrice', 'description', 'features',
      'maxStores', 'maxProducts', 'maxOrders', 'maxDeliveryPartners', 'maxStaff',
      'hasPOS', 'hasDelivery', 'hasSubscription', 'hasCustomDomain', 'hasWhiteLabel',
      'hasAdvancedReports', 'hasAPIAccess', 'isActive', 'isPublic', 'sortOrder',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === 'monthlyPrice' || field === 'yearlyPrice') {
          updateData[field] = parseFloat(String(body[field]));
        } else if (field === 'features') {
          updateData[field] = JSON.stringify(body[field]);
        } else {
          updateData[field] = body[field];
        }
      }
    }

    const plan = await db.platformPlan.update({
      where: { id: planId },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: plan });
  } catch (error) {
    console.error('Update plan error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update plan' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ planId: string }> }
) {
  try {
    const { planId } = await params;

    const existing = await db.platformPlan.findUnique({
      where: { id: planId },
      include: { subscriptions: true },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Plan not found' },
        { status: 404 }
      );
    }

    if (existing.subscriptions.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete plan with active subscriptions' },
        { status: 400 }
      );
    }

    await db.platformPlan.delete({ where: { id: planId } });

    return NextResponse.json({ success: true, data: { deleted: true } });
  } catch (error) {
    console.error('Delete plan error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete plan' },
      { status: 500 }
    );
  }
}
