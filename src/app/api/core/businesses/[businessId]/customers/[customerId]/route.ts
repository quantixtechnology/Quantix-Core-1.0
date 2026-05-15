// ============================================================================
// QUANTIX CORE — Customer Detail API
// GET  /api/core/businesses/[businessId]/customers/[customerId]  — Get customer (auth)
// PUT  /api/core/businesses/[businessId]/customers/[customerId]  — Update customer (CLIENT_OWNER+)
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { db } from '@/lib/db';

export const GET = withMiddleware({ requireAuth: true })(async (req, context) => {
  try {
    const params = await context?.params;
    const businessId = params?.businessId as string;
    const customerId = params?.customerId as string;

    const user = req.user!;
    if (!user.isPlatformAdmin && user.businessId !== businessId) {
      return NextResponse.json({ success: false, error: 'Customer not found' }, { status: 404 });
    }

    const customer = await db.customer.findFirst({
      where: { id: customerId, businessId },
      include: {
        addresses: { orderBy: { isDefault: 'desc' } },
        _count: { select: { orders: true, subscriptions: true, invoices: true } },
        orders: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: { id: true, orderNumber: true, status: true, totalAmount: true, createdAt: true },
        },
        subscriptions: {
          take: 5,
          where: { status: { in: ['ACTIVE'] } },
          include: { plan: { select: { name: true, price: true } } },
        },
      },
    });

    if (!customer) return NextResponse.json({ success: false, error: 'Customer not found' }, { status: 404 });

    return NextResponse.json({ success: true, data: customer });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get customer';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});

export const PUT = withMiddleware({ requireAuth: true, requiredRoles: ['CLIENT_OWNER', 'STORE_MANAGER', 'BILLING_STAFF', 'QUANTIX_SUPER_ADMIN'] })(async (req, context) => {
  try {
    const params = await context?.params;
    const businessId = params?.businessId as string;
    const customerId = params?.customerId as string;

    const user = req.user!;
    if (!user.isPlatformAdmin && user.businessId !== businessId) {
      return NextResponse.json({ success: false, error: 'Customer not found' }, { status: 404 });
    }

    const body = (await req.json()) as {
      name?: string; email?: string; phone?: string; avatar?: string;
      gstNumber?: string; dateOfBirth?: string; gender?: string;
      loyaltyTier?: string; notes?: string; isActive?: boolean;
      tags?: string[]; metadata?: Record<string, unknown>; loyaltyPoints?: number;
    };

    const existing = await db.customer.findFirst({ where: { id: customerId, businessId } });
    if (!existing) return NextResponse.json({ success: false, error: 'Customer not found' }, { status: 404 });

    if (body.phone && body.phone !== existing.phone) {
      const phoneExists = await db.customer.findUnique({
        where: { businessId_phone: { businessId, phone: body.phone } },
      });
      if (phoneExists && phoneExists.id !== customerId) {
        return NextResponse.json({ success: false, error: 'Another customer with this phone number already exists' }, { status: 409 });
      }
    }

    const updateData: Record<string, unknown> = {};
    const directFields = ['name', 'email', 'phone', 'avatar', 'gstNumber', 'gender', 'loyaltyTier', 'notes', 'isActive', 'loyaltyPoints'] as const;
    for (const field of directFields) {
      if ((body as Record<string, unknown>)[field] !== undefined) updateData[field] = (body as Record<string, unknown>)[field];
    }
    if (body.dateOfBirth !== undefined) updateData.dateOfBirth = body.dateOfBirth ? new Date(body.dateOfBirth) : null;
    if (body.tags) updateData.tags = JSON.stringify(body.tags);
    if (body.metadata) updateData.metadata = JSON.stringify(body.metadata);

    const customer = await db.customer.update({ where: { id: customerId }, data: updateData });
    return NextResponse.json({ success: true, data: customer, message: 'Customer updated successfully' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update customer';
    const status = message.includes('not found') ? 404 : message.includes('already exists') ? 409 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
});
