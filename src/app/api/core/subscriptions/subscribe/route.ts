// ============================================================================
// QUANTIX CORE — Subscribe Customer API
// POST /api/core/subscriptions/subscribe — Subscribe customer to plan
// ============================================================================

import { NextResponse } from 'next/server';
import { subscribeCustomerToPlan } from '@/lib/core/subscription';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.businessId) {
      return NextResponse.json(
        { success: false, error: 'businessId is required' },
        { status: 400 }
      );
    }
    if (!body.customerId) {
      return NextResponse.json(
        { success: false, error: 'customerId is required' },
        { status: 400 }
      );
    }
    if (!body.planId) {
      return NextResponse.json(
        { success: false, error: 'planId is required' },
        { status: 400 }
      );
    }

    const result = await subscribeCustomerToPlan({
      businessId: body.businessId,
      customerId: body.customerId,
      planId: body.planId,
      paymentMethodId: body.paymentMethodId,
      autoRenew: body.autoRenew,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      message: 'Customer subscribed to plan successfully',
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to subscribe customer';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
