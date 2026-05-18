// ============================================================================
// QUANTIX CORE — Stores API
// GET  /api/core/stores  — List stores for a business (auth required)
// POST /api/core/stores  — Create store (CLIENT_OWNER / platform admin only)
//
// STORE ISOLATION:
//   STORE_MANAGER → GET returns only their assigned store
//   CLIENT_OWNER  → all stores for their business
//   Platform admins → any business via query param
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { listStores, createStore, getStore } from '@/lib/core/store';
import { db } from '@/lib/db';
import type { CreateStoreRequest } from '@/lib/core/types';

export const GET = withMiddleware({ requireAuth: true })(async (req) => {
  try {
    const user = req.user!;
    const { searchParams } = new URL(req.url);

    // Resolve businessId — platform admins pass it as a query param
    let businessId: string;
    if (user.isPlatformAdmin) {
      const qb = searchParams.get('businessId');
      if (!qb) {
        return NextResponse.json(
          { success: false, error: 'businessId query parameter is required' },
          { status: 400 }
        );
      }
      businessId = qb;
    } else {
      if (!user.businessId) {
        return NextResponse.json(
          { success: false, error: 'No business context found for this user' },
          { status: 400 }
        );
      }
      businessId = user.businessId;
    }

    // STORE_MANAGER: only return their assigned store
    if (user.role === 'STORE_MANAGER' && user.storeId) {
      const store = await getStore(user.storeId);
      return NextResponse.json({ success: true, data: [store] });
    }

    const stores = await listStores(businessId);
    return NextResponse.json({ success: true, data: stores });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list stores';
    return NextResponse.json(
      { success: false, error: message },
      { status: message.includes('not found') ? 404 : 500 }
    );
  }
});

export const POST = withMiddleware({ requireAuth: true, requiredRoles: ['CLIENT_OWNER', 'QUANTIX_SUPER_ADMIN', 'QUANTIX_SALES_TEAM'] })(async (req) => {
  try {
    const user = req.user!;
    const body = (await req.json()) as CreateStoreRequest & { businessId?: string };

    if (!body.name || !body.slug) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: name, slug' },
        { status: 400 }
      );
    }

    // Resolve businessId — platform admins may pass it; business users use their context
    const businessId: string = user.isPlatformAdmin
      ? (body.businessId ?? user.businessId ?? '')
      : (user.businessId ?? '');

    if (!businessId) {
      return NextResponse.json(
        { success: false, error: 'businessId is required' },
        { status: 400 }
      );
    }

    const store = await createStore(businessId, body);

    // Auto-provision tax configs (copy business-level defaults) and delivery zone for the new store
    try {
      const [existingTaxConfigs, existingZone] = await Promise.all([
        db.taxConfig.findMany({ where: { businessId, storeId: null, isActive: true } }),
        db.deliveryZone.findFirst({ where: { businessId, storeId: null } }),
      ]);

      if (existingTaxConfigs.length > 0) {
        await db.taxConfig.createMany({
          data: existingTaxConfigs.map(tc => ({
            businessId,
            storeId:    store.id,
            name:       tc.name,
            taxType:    tc.taxType,
            rate:       tc.rate,
            cgstRate:   tc.cgstRate,
            sgstRate:   tc.sgstRate,
            igstRate:   tc.igstRate,
            cessRate:   tc.cessRate,
            isDefault:  tc.isDefault,
            isActive:   true,
          })),
        });
      }

      if (existingZone) {
        await db.deliveryZone.create({
          data: {
            businessId,
            storeId:          store.id,
            name:             `${store.name} Delivery Zone`,
            zoneType:         existingZone.zoneType,
            centerLat:        body.latitude  ?? existingZone.centerLat,
            centerLng:        body.longitude ?? existingZone.centerLng,
            radius:           existingZone.radius,
            deliveryFee:      existingZone.deliveryFee,
            minOrderAmount:   existingZone.minOrderAmount,
            freeDeliveryAbove: existingZone.freeDeliveryAbove,
            estimatedTime:    existingZone.estimatedTime,
            isActive:         true,
          },
        });
      } else {
        await db.deliveryZone.create({
          data: {
            businessId,
            storeId:        store.id,
            name:           `${store.name} Delivery Zone`,
            zoneType:       'CIRCLE',
            centerLat:      body.latitude  ?? null,
            centerLng:      body.longitude ?? null,
            radius:         5,
            deliveryFee:    0,
            minOrderAmount: 0,
            estimatedTime:  30,
            isActive:       true,
          },
        });
      }
    } catch {
      // Non-fatal — store is created; provisioning can be done manually
    }

    return NextResponse.json(
      { success: true, data: store, message: 'Store created successfully' },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create store';
    const status = message.includes('not found') ? 404
      : message.includes('already exists') ? 409
      : message.includes('Store limit') ? 402
      : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
});
