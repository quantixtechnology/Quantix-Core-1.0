// ============================================================================
// QUANTIX CORE — Customer Detail API
// GET  /api/core/businesses/[businessId]/customers/[customerId]  — Get customer
// PUT  /api/core/businesses/[businessId]/customers/[customerId]  — Update customer
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string; customerId: string }> }
) {
  try {
    const { businessId, customerId } = await params;

    const customer = await db.customer.findFirst({
      where: { id: customerId, businessId },
      include: {
        addresses: { orderBy: { isDefault: 'desc' } },
        _count: {
          select: { orders: true, subscriptions: true, invoices: true },
        },
        orders: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            orderNumber: true,
            status: true,
            totalAmount: true,
            createdAt: true,
          },
        },
        subscriptions: {
          take: 5,
          where: { status: { in: ['ACTIVE'] } },
          include: {
            plan: { select: { name: true, price: true } },
          },
        },
      },
    });

    if (!customer) {
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: customer,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get customer';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ businessId: string; customerId: string }> }
) {
  try {
    const { businessId, customerId } = await params;
    const body = (await request.json()) as {
      name?: string;
      email?: string;
      phone?: string;
      avatar?: string;
      gstNumber?: string;
      isActive?: boolean;
      tags?: string[];
      metadata?: Record<string, unknown>;
      loyaltyPoints?: number;
    };

    // Verify customer belongs to business
    const existing = await db.customer.findFirst({
      where: { id: customerId, businessId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Check phone uniqueness if changing
    if (body.phone && body.phone !== existing.phone) {
      const phoneExists = await db.customer.findUnique({
        where: { businessId_phone: { businessId, phone: body.phone } },
      });
      if (phoneExists && phoneExists.id !== customerId) {
        return NextResponse.json(
          { success: false, error: 'Another customer with this phone number already exists' },
          { status: 409 }
        );
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    const directFields = ['name', 'email', 'phone', 'avatar', 'gstNumber', 'isActive', 'loyaltyPoints'] as const;
    for (const field of directFields) {
      if ((body as Record<string, unknown>)[field] !== undefined) {
        updateData[field] = (body as Record<string, unknown>)[field];
      }
    }

    if (body.tags) {
      updateData.tags = JSON.stringify(body.tags);
    }
    if (body.metadata) {
      updateData.metadata = JSON.stringify(body.metadata);
    }

    const customer = await db.customer.update({
      where: { id: customerId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: customer,
      message: 'Customer updated successfully',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update customer';
    const status = message.includes('not found') ? 404 :
                   message.includes('already exists') ? 409 : 500;
    return NextResponse.json(
      { success: false, error: message },
      { status }
    );
  }
}
