// ============================================================================
// Route: GET /api/admin/billing/[businessId]/history
// Returns year-wise grouped billing history for a business.
// ============================================================================

import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';

export const GET = withMiddleware({
  requireAuth: true,
  requiredPermission: 'subscriptions:view',
})(async (_req, context) => {
  try {
    const params = await context?.params;
    const businessId = params?.businessId as string;
    if (!businessId) {
      return NextResponse.json({ success: false, error: 'businessId required' }, { status: 400 });
    }

    const sub = await db.businessSubscription.findUnique({
      where: { businessId },
      select: { id: true },
    });
    if (!sub) {
      return NextResponse.json({ success: false, error: 'No subscription found' }, { status: 404 });
    }

    const records = await db.billingRecord.findMany({
      where: { businessSubscriptionId: sub.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        amount: true,
        currency: true,
        status: true,
        invoiceNumber: true,
        paymentMode: true,
        paidBy: true,
        receiptReference: true,
        remarks: true,
        periodYear: true,
        periodLabel: true,
        dueDate: true,
        paidDate: true,
        description: true,
        gstRate: true,
        cgstAmount: true,
        sgstAmount: true,
        igstAmount: true,
        totalWithGst: true,
        extraStores: true,
        extraStoreAmount: true,
        createdAt: true,
      },
    });

    // Group by year
    const byYear: Record<number, typeof records> = {};
    for (const r of records) {
      const year = r.periodYear ?? new Date(r.createdAt).getFullYear();
      if (!byYear[year]) byYear[year] = [];
      byYear[year].push(r);
    }

    const grouped = Object.entries(byYear)
      .map(([year, items]) => ({
        year: Number(year),
        records: items,
        totalPaid: items
          .filter((r) => r.status === 'paid')
          .reduce((sum, r) => sum + r.amount, 0),
      }))
      .sort((a, b) => b.year - a.year);

    return NextResponse.json({ success: true, data: grouped, totalRecords: records.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch billing history';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
