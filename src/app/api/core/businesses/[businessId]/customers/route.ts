// ============================================================================
// QUANTIX CORE — Business Customers API
// GET  /api/core/businesses/[businessId]/customers  — List customers
// POST /api/core/businesses/[businessId]/customers  — Create customer
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;
    const { searchParams } = new URL(request.url);

    // Verify business exists
    const business = await db.business.findUnique({ where: { id: businessId } });
    if (!business) {
      return NextResponse.json(
        { success: false, error: 'Business not found' },
        { status: 404 }
      );
    }

    // Pagination
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const skip = (page - 1) * limit;

    // Filters
    const search = searchParams.get('search') || undefined;
    const isActiveParam = searchParams.get('isActive');
    const isActive = isActiveParam !== null ? isActiveParam === 'true' : undefined;
    const minOrders = searchParams.get('minOrders')
      ? parseInt(searchParams.get('minOrders')!, 10)
      : undefined;
    const minSpent = searchParams.get('minSpent')
      ? parseFloat(searchParams.get('minSpent')!)
      : undefined;

    // Build where clause
    const where: Record<string, unknown> = { businessId };

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
      ];
    }

    if (minOrders !== undefined) {
      where.totalOrders = { gte: minOrders };
    }

    if (minSpent !== undefined) {
      where.totalSpent = { gte: minSpent };
    }

    const [customers, total] = await Promise.all([
      db.customer.findMany({
        where,
        skip,
        take: limit,
        include: {
          _count: {
            select: { orders: true, addresses: true, subscriptions: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.customer.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: customers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list customers';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;
    const body = (await request.json()) as {
      name: string;
      email?: string;
      phone?: string;
      avatar?: string;
      gstNumber?: string;
      tags?: string[];
      metadata?: Record<string, unknown>;
      userId?: string;
    };

    if (!body.name) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: name' },
        { status: 400 }
      );
    }

    // Verify business exists
    const business = await db.business.findUnique({ where: { id: businessId } });
    if (!business) {
      return NextResponse.json(
        { success: false, error: 'Business not found' },
        { status: 404 }
      );
    }

    // Check phone uniqueness within business
    if (body.phone) {
      const existingCustomer = await db.customer.findUnique({
        where: { businessId_phone: { businessId, phone: body.phone } },
      });
      if (existingCustomer) {
        return NextResponse.json(
          { success: false, error: 'Customer with this phone number already exists' },
          { status: 409 }
        );
      }
    }

    const customer = await db.customer.create({
      data: {
        businessId,
        userId: body.userId,
        name: body.name,
        email: body.email,
        phone: body.phone,
        avatar: body.avatar,
        gstNumber: body.gstNumber,
        tags: body.tags ? JSON.stringify(body.tags) : '[]',
        metadata: body.metadata ? JSON.stringify(body.metadata) : '{}',
      },
    });

    return NextResponse.json(
      { success: true, data: customer, message: 'Customer created successfully' },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create customer';
    const status = message.includes('already exists') ? 409 : 500;
    return NextResponse.json(
      { success: false, error: message },
      { status }
    );
  }
}
