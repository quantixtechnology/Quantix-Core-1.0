// ============================================================================
// Route: GET /api/admin/billing/renewals
// Returns renewal grid for all active business subscriptions.
// Renewal status is derived at query time — no stored enum.
// ============================================================================

import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';

function getRenewalStatus(
  subStatus: string,
  lastPaymentDate: Date | null,
  currentPeriodStart: Date,
  nextBillingDate: Date,
  now: Date
): string {
  if (subStatus === 'SUSPENDED') return 'Suspended';
  if (subStatus === 'CANCELLED') return 'Cancelled';

  const daysUntilDue = Math.ceil(
    (nextBillingDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Paid: last payment is within the current period
  if (lastPaymentDate && lastPaymentDate >= currentPeriodStart) return 'Paid';
  if (daysUntilDue < 0) return 'Overdue';
  if (daysUntilDue <= 7) return 'Due';
  return 'Upcoming';
}

export const GET = withMiddleware({
  requireAuth: true,
  requiredPermission: 'subscriptions:view',
})(async () => {
  try {
    const now = new Date();

    const subscriptions = await db.businessSubscription.findMany({
      where: {
        status: { not: 'EXPIRED' },
      },
      select: {
        id: true,
        status: true,
        billingCycle: true,
        subscriptionAmount: true,
        discountAmount: true,
        finalAmount: true,
        planPrice: true,
        customPrice: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
        nextBillingDate: true,
        lastPaymentDate: true,
        lastPaymentAmount: true,
        reminderSentAt: true,
        notes: true,
        allowedStores: true,
        plan: { select: { tier: true, name: true, maxStores: true } },
        business: {
          select: {
            id: true,
            name: true,
            businessType: true,
            status: true,
            contactPhone: true,
            contactEmail: true,
          },
        },
        billingHistory: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            amount: true,
            status: true,
            paidDate: true,
            paymentMode: true,
            invoiceNumber: true,
            periodLabel: true,
          },
        },
      },
      orderBy: { nextBillingDate: 'asc' },
    });

    const rows = subscriptions.map((sub) => {
      const renewalStatus = getRenewalStatus(
        sub.status,
        sub.lastPaymentDate,
        sub.currentPeriodStart,
        sub.nextBillingDate,
        now
      );

      const daysUntilDue = Math.ceil(
        (sub.nextBillingDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      const baseAmountDue =
        sub.finalAmount ?? sub.subscriptionAmount ?? sub.customPrice ?? sub.planPrice ?? 0;
      const extraStores = Math.max(0, (sub.allowedStores ?? 1) - (sub.plan.maxStores ?? 1));
      const extraStoreAmount = extraStores > 0 ? extraStores * 1999 : 0;
      const amountDue = baseAmountDue + extraStoreAmount;

      return {
        subscriptionId: sub.id,
        businessId: sub.business.id,
        businessName: sub.business.name,
        businessType: sub.business.businessType,
        businessStatus: sub.business.status,
        contactPhone: sub.business.contactPhone,
        contactEmail: sub.business.contactEmail,
        planTier: sub.plan.tier,
        planName: sub.plan.name,
        billingCycle: sub.billingCycle,
        subscriptionStatus: sub.status,
        renewalStatus,
        daysUntilDue,
        baseAmountDue,
        extraStores,
        extraStoreAmount,
        amountDue,
        currentPeriodStart: sub.currentPeriodStart,
        currentPeriodEnd: sub.currentPeriodEnd,
        nextBillingDate: sub.nextBillingDate,
        lastPaymentDate: sub.lastPaymentDate,
        lastPaymentAmount: sub.lastPaymentAmount,
        reminderSentAt: sub.reminderSentAt,
        lastRecord: sub.billingHistory[0] ?? null,
        notes: sub.notes,
      };
    });

    // Stats
    const dueToday = rows.filter((r) => r.daysUntilDue === 0).length;
    const overdue = rows.filter((r) => r.renewalStatus === 'Overdue').length;
    const upcomingNextWeek = rows.filter(
      (r) => r.daysUntilDue > 0 && r.daysUntilDue <= 7 && r.renewalStatus !== 'Paid'
    ).length;
    const suspended = rows.filter((r) => r.renewalStatus === 'Suspended').length;

    // Collections this month
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const paidThisMonth = await db.billingRecord.aggregate({
      where: {
        status: 'paid',
        paidDate: { gte: monthStart, lte: monthEnd },
      },
      _sum: { amount: true },
    });
    const collectionsThisMonth = paidThisMonth._sum.amount ?? 0;

    return NextResponse.json({
      success: true,
      data: rows,
      total: rows.length,
      stats: {
        dueToday,
        overdue,
        upcomingNextWeek,
        suspended,
        collectionsThisMonth,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch renewals';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
