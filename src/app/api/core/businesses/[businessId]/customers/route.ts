// ============================================================================
// QUANTIX CORE — Business Customers API
// GET  /api/core/businesses/[businessId]/customers  — List customers (auth required)
// POST /api/core/businesses/[businessId]/customers  — Create customer (CLIENT_OWNER+)
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { db } from '@/lib/db';

export const GET = withMiddleware({ requireAuth: true })(async (req, context) => {
  try {
    const params = await context?.params;
    const businessId = params?.businessId as string;
    if (!businessId) return NextResponse.json({ success: false, error: 'businessId is required' }, { status: 400 });

    const user = req.user!;
    if (!user.isPlatformAdmin && user.businessId !== businessId) {
      return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 });
    }

    const business = await db.business.findUnique({ where: { id: businessId } });
    if (!business) return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const skip = (page - 1) * limit;
    const search = searchParams.get('search') || undefined;
    const isActiveParam = searchParams.get('isActive');
    const isActive = isActiveParam !== null ? isActiveParam === 'true' : undefined;
    const minOrders = searchParams.get('minOrders') ? parseInt(searchParams.get('minOrders')!, 10) : undefined;
    const minSpent = searchParams.get('minSpent') ? parseFloat(searchParams.get('minSpent')!) : undefined;

    const where: Record<string, unknown> = { businessId };
    if (isActive !== undefined) where.isActive = isActive;
    if (search) where.OR = [{ name: { contains: search } }, { email: { contains: search } }, { phone: { contains: search } }];
    if (minOrders !== undefined) where.totalOrders = { gte: minOrders };
    if (minSpent !== undefined) where.totalSpent = { gte: minSpent };

    const [customers, total] = await Promise.all([
      db.customer.findMany({
        where, skip, take: limit,
        include: { _count: { select: { orders: true, addresses: true, subscriptions: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      db.customer.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: customers,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasNext: page * limit < total, hasPrev: page > 1 },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list customers';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});

export const POST = withMiddleware({ requireAuth: true, requiredRoles: ['CLIENT_OWNER', 'STORE_MANAGER', 'BILLING_STAFF', 'QUANTIX_SUPER_ADMIN'] })(async (req, context) => {
  try {
    const params = await context?.params;
    const businessId = params?.businessId as string;
    if (!businessId) return NextResponse.json({ success: false, error: 'businessId is required' }, { status: 400 });

    const user = req.user!;
    if (!user.isPlatformAdmin && user.businessId !== businessId) {
      return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 });
    }

    const body = (await req.json()) as {
      name: string; email?: string; phone?: string; avatar?: string;
      gstNumber?: string; dateOfBirth?: string; gender?: string;
      loyaltyTier?: string; notes?: string; tags?: string[];
      metadata?: Record<string, unknown>; userId?: string;
    };

    if (!body.name) return NextResponse.json({ success: false, error: 'Missing required field: name' }, { status: 400 });

    const business = await db.business.findUnique({ where: { id: businessId } });
    if (!business) return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 });

    if (body.phone) {
      const existingCustomer = await db.customer.findUnique({
        where: { businessId_phone: { businessId, phone: body.phone } },
      });
      if (existingCustomer) {
        return NextResponse.json({ success: false, error: 'Customer with this phone number already exists' }, { status: 409 });
      }
    }

    const customer = await db.customer.create({
      data: {
        businessId, userId: body.userId, name: body.name, email: body.email, phone: body.phone,
        avatar: body.avatar, gstNumber: body.gstNumber,
        dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : undefined,
        gender: body.gender, loyaltyTier: body.loyaltyTier || 'BRONZE',
        notes: body.notes || '', tags: body.tags ? JSON.stringify(body.tags) : '[]',
        metadata: body.metadata ? JSON.stringify(body.metadata) : '{}',
      },
    });

    return NextResponse.json({ success: true, data: customer, message: 'Customer created successfully' }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create customer';
    return NextResponse.json({ success: false, error: message }, { status: message.includes('already exists') ? 409 : 500 });
  }
});
