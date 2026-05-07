// ============================================================================
// QUANTIX CORE — Payments API
// GET  /api/core/payments  — List payments with filtering & pagination
// POST /api/core/payments  — Create a manual payment record (cash/COD)
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { db } from '@/lib/db';
import { createPayment } from '@/lib/core/payment';
import { logPaymentActivity } from '@/lib/core/audit';

// ============================================================================
// GET — List payments with filtering and pagination
// ============================================================================

export const GET = withMiddleware({ requireAuth: true })(
  async (req) => {
    try {
      const { searchParams } = new URL(req.url);
      const user = req.user!;

      // businessId can come from query param or user context
      const businessId = searchParams.get('businessId') || user.businessId || undefined;

      if (!businessId) {
        return NextResponse.json(
          { success: false, error: 'businessId is required' },
          { status: 400 }
        );
      }

      // Filters
      const orderId = searchParams.get('orderId');
      const status = searchParams.get('status');
      const method = searchParams.get('method');
      const dateFrom = searchParams.get('dateFrom');
      const dateTo = searchParams.get('dateTo');
      const gatewayName = searchParams.get('gatewayName');

      // Pagination
      const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
      const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
      const skip = (page - 1) * limit;

      // Build where clause
      const where: Record<string, unknown> = { businessId };
      if (orderId) where.orderId = orderId;
      if (status) where.status = status;
      if (method) where.method = method;
      if (gatewayName) where.gatewayName = gatewayName;
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
                customerPhone: true,
                status: true,
                totalAmount: true,
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
);

// ============================================================================
// POST — Create a manual payment record (for cash/COD)
// ============================================================================

export const POST = withMiddleware({ requireAuth: true })(
  async (req) => {
    try {
      const body = await req.json();
      const user = req.user!;

      if (!body.orderId) {
        return NextResponse.json(
          { success: false, error: 'orderId is required' },
          { status: 400 }
        );
      }

      const businessId = body.businessId || user.businessId;
      if (!businessId) {
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
        businessId,
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

      // For cash/COD payments, mark as completed immediately
      if ((body.method === 'CASH' || body.method === 'COD') && body.autoComplete !== false) {
        const { updatePaymentStatus } = await import('@/lib/core/payment');
        const statusResult = await updatePaymentStatus(
          result.payment!.id,
          'COMPLETED',
          body.gatewayTransactionId
        );

        if (statusResult.success) {
          // Log activity using the domain-specific logger
          try {
            await logPaymentActivity(
              businessId,
              user.id,
              'payment.manual.completed',
              result.payment!.id,
              {
                method: body.method,
                amount: body.amount,
                orderId: body.orderId,
              },
              req as unknown as { headers?: { get(name: string): string | null } }
            );
          } catch { /* audit logging is non-blocking */ }

          return NextResponse.json({
            success: true,
            data: statusResult.payment,
            message: `${body.method} payment recorded and marked as completed`,
          }, { status: 201 });
        }
      }

      return NextResponse.json({
        success: true,
        data: result.payment,
        message: 'Payment record created successfully',
      }, { status: 201 });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create payment';
      return NextResponse.json(
        { success: false, error: message },
        { status: 500 }
      );
    }
  }
);
