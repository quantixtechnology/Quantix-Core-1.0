// ============================================================================
// QUANTIX CORE — Payments API
// GET  /api/core/payments  — List payments for a business
// POST /api/core/payments  — Create payment record
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createPayment } from '@/lib/core/payment';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');

    if (!businessId) {
      return NextResponse.json(
        { success: false, error: 'businessId is required' },
        { status: 400 }
      );
    }

    const orderId = searchParams.get('orderId');
    const status = searchParams.get('status');
    const method = searchParams.get('method');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { businessId };
    if (orderId) where.orderId = orderId;
    if (status) where.status = status;
    if (method) where.method = method;
    if (dateFrom || dateTo) {
      const createdAt: Record<string, Date> = {};
      if (dateFrom) createdAt.gte = new Date(dateFrom);
      if (dateTo) createdAt.lte = new Date(dateTo);
      where.createdAt = createdAt;
    }

    const [payments, total] = await Promise.all([
      db.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              customerName: true,
            },
          },
        },
      }),
      db.payment.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: payments,
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
    const message = error instanceof Error ? error.message : 'Failed to list payments';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.orderId) {
      return NextResponse.json(
        { success: false, error: 'orderId is required' },
        { status: 400 }
      );
    }
    if (!body.businessId) {
      return NextResponse.json(
        { success: false, error: 'businessId is required' },
        { status: 400 }
      );
    }
    if (body.amount === undefined || body.amount === null || body.amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'amount must be greater than 0' },
        { status: 400 }
      );
    }
    if (!body.method) {
      return NextResponse.json(
        { success: false, error: 'method is required' },
        { status: 400 }
      );
    }

    const validMethods = ['CASH', 'CARD', 'UPI', 'NETBANKING', 'WALLET', 'COD', 'CREDIT', 'MIXED'];
    if (!validMethods.includes(body.method)) {
      return NextResponse.json(
        { success: false, error: `method must be one of: ${validMethods.join(', ')}` },
        { status: 400 }
      );
    }

    const result = await createPayment({
      orderId: body.orderId,
      businessId: body.businessId,
      amount: body.amount,
      currency: body.currency,
      method: body.method,
      gatewayName: body.gatewayName,
      gatewayTransactionId: body.gatewayTransactionId,
      gatewayResponse: body.gatewayResponse,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.payment,
      message: 'Payment created successfully',
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create payment';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
