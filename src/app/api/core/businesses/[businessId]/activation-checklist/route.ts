// ============================================================================
// QUANTIX CORE — Activation Checklist API
// PUT /api/core/businesses/[businessId]/activation-checklist
//   — Toggle a single checklist item. Status is auto-calculated.
// GET /api/core/businesses/[businessId]/activation-checklist
//   — Re-evaluate and return current checklist state.
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { evaluateActivation, toggleChecklistItem } from '@/lib/core/business';

export const PUT = withMiddleware({ requireAuth: true, requiredRoles: ['QUANTIX_SUPER_ADMIN', 'QUANTIX_SALES_TEAM'] })(async (req, context) => {
  try {
    const params = await context?.params;
    const businessId = params?.businessId as string;
    if (!businessId) return NextResponse.json({ success: false, error: 'businessId is required' }, { status: 400 });

    const body = (await req.json()) as { item: string; value: boolean };
    if (!body.item || typeof body.value !== 'boolean') {
      return NextResponse.json({ success: false, error: 'Missing required fields: item (string), value (boolean)' }, { status: 400 });
    }

    const business = await toggleChecklistItem(businessId, body.item, body.value);
    return NextResponse.json({ success: true, data: business });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update checklist';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
});

export const GET = withMiddleware({ requireAuth: true, requiredRoles: ['QUANTIX_SUPER_ADMIN', 'QUANTIX_SALES_TEAM'] })(async (req, context) => {
  try {
    const params = await context?.params;
    const businessId = params?.businessId as string;
    if (!businessId) return NextResponse.json({ success: false, error: 'businessId is required' }, { status: 400 });

    const business = await evaluateActivation(businessId);
    return NextResponse.json({ success: true, data: business });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to evaluate activation';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
});
