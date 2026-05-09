// ============================================================================
// QUANTIX CORE — Business Dashboard API
// GET  /api/core/businesses/[businessId]/dashboard  — Get dashboard data
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;

    // Verify business exists
    const business = await db.business.findUnique({
      where: { id: businessId },
      select: { id: true, name: true, status: true },
    });

    if (!business) {
      return NextResponse.json(
        { success: false, error: 'Business not found' },
        { status: 404 }
      );
    }

    // Fetch all stats in parallel
    const [
      totalOrders,
      pendingOrders,
      activeOrders,
      deliveredOrders,
      totalRevenue,
      totalCustomers,
      activeCustomers,
      totalProducts,
      totalStores,
      todayOrders,
      todayRevenue,
    ] = await Promise.all([
      db.order.count({ where: { businessId } }),
      db.order.count({ where: { businessId, status: 'PENDING' } }),
      db.order.count({
        where: {
          businessId,
          status: { in: ['CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY'] },
        },
      }),
      db.order.count({ where: { businessId, status: 'DELIVERED' } }),
      db.order.aggregate({
        where: { businessId, paymentStatus: 'COMPLETED' },
        _sum: { totalAmount: true },
      }),
      db.customer.count({ where: { businessId } }),
      db.customer.count({
        where: {
          businessId,
          lastOrderAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
      }),
      db.product.count({ where: { businessId } }),
      db.store.count({ where: { businessId } }),
      db.order.count({
        where: {
          businessId,
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
      db.order.aggregate({
        where: {
          businessId,
          paymentStatus: 'COMPLETED',
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
        _sum: { totalAmount: true },
      }),
    ]);

    // Recent orders (last 5)
    const recentOrders = await db.order.findMany({
      where: { businessId },
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalAmount: true,
        customerName: true,
        createdAt: true,
        orderType: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        businessId,
        businessName: business.name,
        businessStatus: business.status,
        orders: {
          total: totalOrders,
          pending: pendingOrders,
          active: activeOrders,
          delivered: deliveredOrders,
          today: todayOrders,
        },
        revenue: {
          total: totalRevenue._sum.totalAmount || 0,
          today: todayRevenue._sum.totalAmount || 0,
        },
        customers: {
          total: totalCustomers,
          active: activeCustomers,
        },
        products: {
          total: totalProducts,
        },
        stores: {
          total: totalStores,
        },
        recentOrders,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get dashboard data';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
