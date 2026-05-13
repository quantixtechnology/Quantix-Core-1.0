// ============================================================================
// QUANTIX CORE — Subscription Reactivation API
// POST /api/core/businesses/[businessId]/subscription/reactivate  — Reactivate suspended/expired subscription
// ============================================================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { reactivatePlatformSubscription } from '@/lib/core/subscription'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params
    const subscription = await db.businessSubscription.findUnique({ where: { businessId } })

    if (!subscription) {
      return NextResponse.json(
        { success: false, error: 'No subscription found for this business' },
        { status: 404 }
      )
    }

    const result = await reactivatePlatformSubscription(subscription.id)
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to reactivate subscription' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      data: result.subscription,
      message: 'Subscription reactivated successfully',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to reactivate subscription'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
