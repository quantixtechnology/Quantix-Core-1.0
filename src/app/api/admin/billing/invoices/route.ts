// ============================================================================
// Route: GET /api/admin/billing/invoices
// Returns all platform invoices (BillingRecords) across all businesses,
// paginated, with business name, GST breakdown and invoice number.
// ============================================================================

import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';

export const GET = withMiddleware({
  requireAuth: true,
  requiredPermission: 'subscriptions:view',
})(async (req) => {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') ?? '';
    const status = searchParams.get('status') ?? '';
    const page = Math.max(1, Number(searchParams.get('page') ?? '1'));
    const limit = Math.min(100, Math.max(10, Number(searchParams.get('limit') ?? '50')));
    const skip = (page - 1) * limit;

    const whereRecord: Record<string, unknown> = {};
    if (status) whereRecord.status = status;

    const whereSub: Record<string, unknown> = {};
    if (search) {
      whereSub.business = { name: { contains: search } };
    }

    const [records, total] = await Promise.all([
      db.billingRecord.findMany({
        where: {
          ...whereRecord,
          subscription: { ...whereSub },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          subscription: {
            include: {
              business: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  gstNumber: true,
                  address: true,
                  city: true,
                  state: true,
                  pincode: true,
                  contactEmail: true,
                  contactPhone: true,
                },
              },
              plan: { select: { name: true, tier: true } },
            },
          },
        },
      }),
      db.billingRecord.count({
        where: {
          ...whereRecord,
          subscription: { ...whereSub },
        },
      }),
    ]);

    const invoices = records.map((r) => ({
      id: r.id,
      invoiceNumber: r.invoiceNumber,
      businessId: r.subscription.business.id,
      businessName: r.subscription.business.name,
      businessSlug: r.subscription.business.slug,
      businessGst: r.subscription.business.gstNumber,
      businessAddress: [r.subscription.business.address, r.subscription.business.city, r.subscription.business.state, r.subscription.business.pincode].filter(Boolean).join(', '),
      businessEmail: r.subscription.business.contactEmail,
      businessPhone: r.subscription.business.contactPhone,
      planName: r.subscription.plan.name,
      planTier: r.subscription.plan.tier,
      amount: r.amount,
      currency: r.currency,
      status: r.status,
      paymentMode: r.paymentMode,
      paidBy: r.paidBy,
      receiptReference: r.receiptReference,
      periodLabel: r.periodLabel,
      periodYear: r.periodYear,
      description: r.description,
      dueDate: r.dueDate,
      paidDate: r.paidDate,
      remarks: r.remarks,
      gstRate: r.gstRate,
      cgstAmount: r.cgstAmount,
      sgstAmount: r.sgstAmount,
      igstAmount: r.igstAmount,
      totalWithGst: r.totalWithGst,
      extraStores: r.extraStores,
      extraStoreAmount: r.extraStoreAmount,
      createdAt: r.createdAt,
    }));

    // Monthly collections stat
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const [totalPaid, monthlyCollections] = await Promise.all([
      db.billingRecord.aggregate({ where: { status: 'paid' }, _sum: { amount: true }, _count: { id: true } }),
      db.billingRecord.aggregate({
        where: { status: 'paid', paidDate: { gte: monthStart, lte: monthEnd } },
        _sum: { amount: true },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: invoices,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      stats: {
        totalInvoices: total,
        totalCollected: totalPaid._sum.amount ?? 0,
        paidCount: totalPaid._count.id,
        collectedThisMonth: monthlyCollections._sum.amount ?? 0,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch invoices';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
