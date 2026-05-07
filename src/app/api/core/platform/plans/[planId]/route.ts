// ============================================================================
// Route: GET/PUT /api/core/platform/plans/[planId]
// Get single platform plan / Update platform plan (QUANTIX_SUPER_ADMIN only)
// ============================================================================

import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

// Helper: Check if request is from QUANTIX_SUPER_ADMIN
function isSuperAdmin(request: Request): boolean {
  const role = request.headers.get('x-user-role');
  return role === 'QUANTIX_SUPER_ADMIN';
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ planId: string }> }
) {
  try {
    const { planId } = await params;

    const plan = await db.platformPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      return NextResponse.json(
        { success: false, error: 'Plan not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        ...plan,
        features: JSON.parse(plan.features),
      },
    });
  } catch (error) {
    console.error('[plan-detail] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch plan' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ planId: string }> }
) {
  try {
    // Check admin access
    if (!isSuperAdmin(request)) {
      return NextResponse.json(
        { success: false, error: 'Only QUANTIX_SUPER_ADMIN can update plans' },
        { status: 403 }
      );
    }

    const { planId } = await params;
    const body = await request.json();

    // Verify plan exists
    const existing = await db.platformPlan.findUnique({ where: { id: planId } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Plan not found' },
        { status: 404 }
      );
    }

    // Build update data (only allow specific fields)
    const updateData: Record<string, unknown> = {};
    const allowedFields = [
      'name', 'monthlyPrice', 'yearlyPrice', 'description',
      'maxStores', 'maxProducts', 'maxOrders', 'maxDeliveryPartners', 'maxStaff',
      'hasPOS', 'hasDelivery', 'hasSubscription', 'hasCustomDomain',
      'hasWhiteLabel', 'hasAdvancedReports', 'hasAPIAccess',
      'isActive', 'isPublic', 'sortOrder',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // Handle features as JSON string
    if (body.features !== undefined) {
      updateData.features = typeof body.features === 'string'
        ? body.features
        : JSON.stringify(body.features);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const updated = await db.platformPlan.update({
      where: { id: planId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: {
        ...updated,
        features: JSON.parse(updated.features),
      },
      message: 'Plan updated successfully',
    });
  } catch (error) {
    console.error('[plan-update] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update plan' },
      { status: 500 }
    );
  }
}
