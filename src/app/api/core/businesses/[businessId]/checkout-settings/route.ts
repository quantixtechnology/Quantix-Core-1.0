// ============================================================================
// QUANTIX CORE — Checkout Settings API
// GET  /api/core/businesses/[businessId]/checkout-settings
// PATCH /api/core/businesses/[businessId]/checkout-settings
//
// Controls guest checkout availability per business.
// Stored in Business.settings JSON under key allowGuestCheckout (boolean).
// ============================================================================

import { NextResponse } from 'next/server'
import { withMiddleware } from '@/lib/middleware'
import { db } from '@/lib/db'

export const GET = withMiddleware({ requireAuth: true })(async (req, context) => {
  try {
    const params = await context?.params
    const businessId = params?.businessId as string
    if (!businessId) return NextResponse.json({ success: false, error: 'businessId is required' }, { status: 400 })

    const user = req.user!
    if (!user.isPlatformAdmin && user.businessId !== businessId) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    }

    const business = await db.business.findUnique({ where: { id: businessId }, select: { settings: true } })
    if (!business) return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 })

    let parsed: Record<string, unknown> = {}
    try { parsed = JSON.parse(business.settings || '{}') as Record<string, unknown> } catch { /* ignore */ }

    return NextResponse.json({
      success: true,
      data: { allowGuestCheckout: parsed.allowGuestCheckout !== false },
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, { status: 500 })
  }
})

export const PATCH = withMiddleware({ requireAuth: true, requiredRoles: ['CLIENT_OWNER', 'STORE_MANAGER', 'QUANTIX_SUPER_ADMIN'] })(async (req, context) => {
  try {
    const params = await context?.params
    const businessId = params?.businessId as string
    if (!businessId) return NextResponse.json({ success: false, error: 'businessId is required' }, { status: 400 })

    const user = req.user!
    if (!user.isPlatformAdmin && user.businessId !== businessId) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    }

    const body = await req.json() as { allowGuestCheckout: boolean }
    if (typeof body.allowGuestCheckout !== 'boolean') {
      return NextResponse.json({ success: false, error: 'allowGuestCheckout (boolean) is required' }, { status: 400 })
    }

    const business = await db.business.findUnique({ where: { id: businessId }, select: { settings: true } })
    if (!business) return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 })

    let parsed: Record<string, unknown> = {}
    try { parsed = JSON.parse(business.settings || '{}') as Record<string, unknown> } catch { /* ignore */ }

    parsed.allowGuestCheckout = body.allowGuestCheckout

    await db.business.update({
      where: { id: businessId },
      data: { settings: JSON.stringify(parsed) },
    })

    return NextResponse.json({ success: true, data: { allowGuestCheckout: body.allowGuestCheckout } })
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, { status: 500 })
  }
})
