import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;

    const [
      totalOrders,
      totalRevenue,
      totalCustomers,
      totalProducts,
      activeStores,
      recentOrders,
      ordersByStatus,
    ] = await Promise.all([
      db.order.count({ where: { businessId } }),
      db.order.aggregate({ where: { businessId, paymentStatus: 'COMPLETED' }, _sum: { totalAmount: true } }),
      db.customer.count({ where: { businessId } }),
      db.product.count({ where: { businessId } }),
      db.store.count({ where: { businessId, status: 'ACTIVE' } }),
      db.order.findMany({
        where: { businessId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, orderNumber: true, status: true, totalAmount: true, createdAt: true },
      }),
      db.order.groupBy({
        by: ['status'],
        where: { businessId },
        _count: { status: true },
      }),
    ]);

    const totalDeliveryPartners = await db.deliveryPartner.count({
      where: { businessId, isActive: true },
    });

    const activeSubscriptions = await db.customerSubscription.count({
      where: { businessId, status: 'ACTIVE' },
    });

    return NextResponse.json({
      success: true,
      data: {
        totalOrders,
        totalRevenue: totalRevenue._sum.totalAmount || 0,
        totalCustomers,
        totalProducts,
        activeStores,
        totalDeliveryPartners,
        activeSubscriptions,
        recentOrders,
        ordersByStatus: ordersByStatus.reduce((acc: Record<string, number>, item) => {
          acc[item.status] = item._count.status;
          return acc;
        }, {}),
      },
    });
  } catch (error) {
    console.error('Business stats error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch business stats' },
      { status: 500 }
    );
  }
}
