import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withBusinessAccess } from '@/lib/api-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  const { businessId } = await params;
  return withBusinessAccess(request, businessId, async () => {
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const [
        totalOrders,
        totalRevenue,
        totalCustomers,
        totalProducts,
        totalStores,
        activeDeliveryPartners,
        recentOrders,
        todayOrders,
        todayRevenue,
        pendingOrders,
        ordersByStatus,
        revenueLast30Days,
        topProducts,
        ordersLast7Days,
      ] = await Promise.all([
        // Total orders
        db.order.count({ where: { businessId } }),

        // Total revenue
        db.order.aggregate({
          where: { businessId, paymentStatus: 'COMPLETED' },
          _sum: { totalAmount: true },
        }),

        // Total customers
        db.customer.count({ where: { businessId } }),

        // Total products
        db.product.count({ where: { businessId, status: 'ACTIVE' } }),

        // Total stores
        db.store.count({ where: { businessId, status: 'ACTIVE' } }),

        // Active delivery partners
        db.deliveryPartner.count({ where: { businessId, isOnline: true } }),

        // Recent orders
        db.order.findMany({
          where: { businessId },
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            customer: { select: { name: true, phone: true } },
            items: { take: 3, select: { productName: true, quantity: true, totalPrice: true } },
          },
        }),

        // Today's orders
        db.order.count({
          where: { businessId, createdAt: { gte: todayStart } },
        }),

        // Today's revenue
        db.order.aggregate({
          where: { businessId, paymentStatus: 'COMPLETED', createdAt: { gte: todayStart } },
          _sum: { totalAmount: true },
        }),

        // Pending orders
        db.order.count({
          where: { businessId, status: { in: ['PENDING', 'CONFIRMED', 'PREPARING'] } },
        }),

        // Orders by status
        db.order.groupBy({
          by: ['status'],
          where: { businessId },
          _count: { status: true },
        }),

        // Revenue last 30 days (daily)
        db.order.groupBy({
          by: ['createdAt'],
          where: {
            businessId,
            paymentStatus: 'COMPLETED',
            createdAt: { gte: thirtyDaysAgo },
          },
          _sum: { totalAmount: true },
        }),

        // Top products
        db.orderItem.groupBy({
          by: ['productId', 'productName'],
          where: { order: { businessId } },
          _sum: { quantity: true, totalPrice: true },
          orderBy: { _sum: { totalPrice: 'desc' } },
          take: 5,
        }),

        // Orders last 7 days (daily)
        db.order.groupBy({
          by: ['createdAt'],
          where: { businessId, createdAt: { gte: sevenDaysAgo } },
          _count: { id: true },
        }),
      ]);

      // Get previous period for comparison
      const prev30Days = new Date(thirtyDaysAgo.getTime() - 30 * 24 * 60 * 60 * 1000);
      const prevPeriodRevenue = await db.order.aggregate({
        where: {
          businessId,
          paymentStatus: 'COMPLETED',
          createdAt: { gte: prev30Days, lt: thirtyDaysAgo },
        },
        _sum: { totalAmount: true },
      });

      const prevPeriodOrders = await db.order.count({
        where: { businessId, createdAt: { gte: prev30Days, lt: thirtyDaysAgo } },
      });

      const currentRevenue = totalRevenue._sum.totalAmount || 0;
      const prevRevenue = prevPeriodRevenue._sum.totalAmount || 0;
      const revenueGrowth = prevRevenue > 0 ? ((currentRevenue - prevRevenue) / prevRevenue * 100) : 0;
      const orderGrowth = prevPeriodOrders > 0 ? ((totalOrders - prevPeriodOrders) / prevPeriodOrders * 100) : 0;

      return NextResponse.json({
        success: true,
        data: {
          overview: {
            totalOrders,
            totalRevenue: currentRevenue,
            totalCustomers,
            totalProducts,
            totalStores,
            activeDeliveryPartners,
            pendingOrders,
            todayOrders,
            todayRevenue: todayRevenue._sum.totalAmount || 0,
            revenueGrowth: Math.round(revenueGrowth * 100) / 100,
            orderGrowth: Math.round(orderGrowth * 100) / 100,
          },
          ordersByStatus: ordersByStatus.map(o => ({
            status: o.status,
            count: o._count.status,
          })),
          topProducts,
          recentOrders,
          revenueLast30Days,
          ordersLast7Days,
        },
      });
    } catch (error) {
      console.error('Business stats error:', error);
      return NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 }
      );
    }
  });
}
