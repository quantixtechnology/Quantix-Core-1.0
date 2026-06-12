// ============================================================================
// QUANTIX CORE — Delivery Partner Earnings API
// GET /api/core/delivery/my-earnings — Earnings for delivery partner
//
// Auth required (DELIVERY_STAFF)
// Returns today/weekly/monthly earnings summary
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { db } from '@/lib/db';

export const GET = withMiddleware({ requireAuth: true, requiredRoles: ['DELIVERY_STAFF'] })(
  async (req) => {
    try {
      const user = req.user!;

      // Find the delivery partner profile.
      // SECURITY: scoped by businessId so earnings can never resolve to a
      // partner profile from a different business the user also belongs to.
      const deliveryPartner = await db.deliveryPartner.findFirst({
        where: {
          userId: user.id,
          ...(user.businessId ? { businessId: user.businessId } : {}),
          isActive: true,
        },
      });

      if (!deliveryPartner) {
        return NextResponse.json(
          { success: false, error: 'Delivery partner profile not found' },
          { status: 404 }
        );
      }

      // Get all completed deliveries for this partner
      const completedDeliveries = await db.delivery.findMany({
        where: {
          deliveryPartnerId: deliveryPartner.id,
          status: 'DELIVERED',
        },
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              totalAmount: true,
              deliveryFee: true,
              deliveredAt: true,
            },
          },
        },
        orderBy: { actualDeliveryTime: 'desc' },
      });

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(todayStart);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Start of week (Sunday)
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      // Calculate earnings per period
      const calculateEarnings = (startDate: Date) => {
        const periodDeliveries = completedDeliveries.filter(
          (d) => d.actualDeliveryTime && d.actualDeliveryTime >= startDate
        );
        const totalEarnings = periodDeliveries.reduce((sum, d) => {
          const earning = (d.order?.deliveryFee || 0) * 0.7; // 70% of delivery fee
          return sum + earning;
        }, 0);
        return {
          count: periodDeliveries.length,
          earnings: Math.round(totalEarnings * 100) / 100,
        };
      };

      const todayStats = calculateEarnings(todayStart);
      const weeklyStats = calculateEarnings(weekStart);
      const monthlyStats = calculateEarnings(monthStart);

      // Recent delivery earnings (last 10)
      const recentEarnings = completedDeliveries.slice(0, 10).map((d) => ({
        orderId: d.order?.id,
        orderNumber: d.order?.orderNumber,
        deliveryFee: d.order?.deliveryFee || 0,
        earning: Math.round(((d.order?.deliveryFee || 0) * 0.7) * 100) / 100,
        deliveredAt: d.actualDeliveryTime,
      }));

      return NextResponse.json({
        success: true,
        data: {
          partner: {
            id: deliveryPartner.id,
            name: deliveryPartner.name,
            totalDeliveries: deliveryPartner.totalDeliveries,
            totalEarnings: deliveryPartner.totalEarnings,
            rating: deliveryPartner.rating,
            isOnline: deliveryPartner.isOnline,
          },
          today: todayStats,
          thisWeek: weeklyStats,
          thisMonth: monthlyStats,
          recentEarnings,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch earnings';
      return NextResponse.json(
        { success: false, error: message },
        { status: 500 }
      );
    }
  }
);
