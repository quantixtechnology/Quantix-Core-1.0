// ============================================================================
// Route: POST /api/admin/billing/[businessId]/mark-received
// Manually records a subscription payment received for a business.
// Generates a sequential QTX/YYYY-YY/0001 GST invoice number.
// ============================================================================

import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';

const EXTRA_STORE_RATE = 1999;
const GST_RATE = 18;

function getFinancialYear(date: Date): string {
  const m = date.getMonth(); // 0-indexed
  const y = date.getFullYear();
  const startYear = m >= 3 ? y : y - 1; // April (3) = new FY
  const endYear = (startYear + 1) % 100;
  return `${startYear}-${String(endYear).padStart(2, '0')}`;
}

async function generateInvoiceNumber(date: Date): Promise<string> {
  const financialYear = getFinancialYear(date);
  const seq = await db.invoiceSequence.upsert({
    where: { financialYear },
    update: { nextVal: { increment: 1 } },
    create: { financialYear, nextVal: 2 },
  });
  const serial = seq.nextVal - 1; // post-update value minus 1 gives us the one we just used
  // Actually upsert returns the record after update, nextVal is already incremented.
  // We want the value that was just assigned, which is nextVal - 1 after increment.
  // For create case: nextVal = 2, so assigned = 1. For update: assigned = old value.
  return `QTX/${financialYear}/${String(serial).padStart(4, '0')}`;
}

function addPeriod(date: Date, cycle: string): Date {
  const d = new Date(date);
  switch (cycle) {
    case 'MONTHLY':      d.setMonth(d.getMonth() + 1); break;
    case 'QUARTERLY':    d.setMonth(d.getMonth() + 3); break;
    case 'HALF_YEARLY':  d.setMonth(d.getMonth() + 6); break;
    case 'YEARLY':       d.setFullYear(d.getFullYear() + 1); break;
  }
  return d;
}

export const POST = withMiddleware({
  requireAuth: true,
  requiredRoles: ['QUANTIX_SUPER_ADMIN', 'PLATFORM_ADMIN', 'FINANCE_TEAM'],
})(async (req, context) => {
  try {
    const params = await context?.params;
    const businessId = params?.businessId as string;
    if (!businessId) {
      return NextResponse.json({ success: false, error: 'businessId required' }, { status: 400 });
    }

    const body = (await req.json()) as {
      amount: number;
      paymentMode: string;
      paidBy?: string;
      receiptReference?: string;
      remarks?: string;
      periodYear?: number;
      periodLabel?: string;
      paidDate?: string;
      includeGst?: boolean;
      isInterState?: boolean;
    };

    if (!body.amount || body.amount <= 0) {
      return NextResponse.json({ success: false, error: 'amount must be positive' }, { status: 400 });
    }
    if (!body.paymentMode) {
      return NextResponse.json({ success: false, error: 'paymentMode required' }, { status: 400 });
    }

    const sub = await db.businessSubscription.findUnique({
      where: { businessId },
      include: { plan: true },
    });
    if (!sub) {
      return NextResponse.json({ success: false, error: 'No subscription found for this business' }, { status: 404 });
    }

    const paidDate = body.paidDate ? new Date(body.paidDate) : new Date();
    const includeGst = body.includeGst !== false; // default true

    // Compute extra store charges
    const extraStores = Math.max(0, (sub.allowedStores ?? 1) - (sub.plan.maxStores ?? 1));
    const extraStoreAmount = extraStores > 0 ? extraStores * EXTRA_STORE_RATE : 0;

    // GST computation
    let cgstAmount: number | null = null;
    let sgstAmount: number | null = null;
    let igstAmount: number | null = null;
    let totalWithGst: number | null = null;

    if (includeGst) {
      const isInterState = body.isInterState ?? false;
      const gstAmount = Math.round(body.amount * (GST_RATE / 100) * 100) / 100;
      if (isInterState) {
        igstAmount = gstAmount;
        cgstAmount = 0;
        sgstAmount = 0;
      } else {
        cgstAmount = Math.round(gstAmount / 2 * 100) / 100;
        sgstAmount = Math.round(gstAmount / 2 * 100) / 100;
        igstAmount = 0;
      }
      totalWithGst = Math.round((body.amount + gstAmount + extraStoreAmount) * 100) / 100;
    }

    const invoiceNumber = await generateInvoiceNumber(paidDate);

    // Create BillingRecord
    await db.billingRecord.create({
      data: {
        businessSubscriptionId: sub.id,
        amount: body.amount,
        currency: 'INR',
        status: 'paid',
        invoiceNumber,
        dueDate: sub.nextBillingDate,
        paidDate,
        paymentMode: body.paymentMode,
        paidBy: body.paidBy ?? null,
        receiptReference: body.receiptReference ?? null,
        remarks: body.remarks ?? null,
        periodYear: body.periodYear ?? paidDate.getFullYear(),
        periodLabel: body.periodLabel ?? null,
        description: `Platform subscription — ${sub.plan.name} — ${body.paymentMode}`,
        gstRate: includeGst ? GST_RATE : null,
        cgstAmount: cgstAmount ?? null,
        sgstAmount: sgstAmount ?? null,
        igstAmount: igstAmount ?? null,
        totalWithGst: totalWithGst ?? null,
        extraStores: extraStores > 0 ? extraStores : null,
        extraStoreAmount: extraStoreAmount > 0 ? extraStoreAmount : null,
      },
    });

    // Advance subscription period
    const newPeriodStart = sub.nextBillingDate;
    const newPeriodEnd = addPeriod(newPeriodStart, sub.billingCycle);

    await db.businessSubscription.update({
      where: { id: sub.id },
      data: {
        lastPaymentDate: paidDate,
        lastPaymentAmount: body.amount,
        paymentVerified: true,
        paymentVerifiedAt: paidDate,
        currentPeriodStart: newPeriodStart,
        currentPeriodEnd: newPeriodEnd,
        nextBillingDate: newPeriodEnd,
        status: sub.status === 'PAST_DUE' ? 'ACTIVE' : undefined,
      },
    });

    // Audit log
    await db.activityLog.create({
      data: {
        businessId,
        action: 'BILLING_PAYMENT_RECEIVED',
        entity: 'BusinessSubscription',
        entityId: sub.id,
        details: JSON.stringify({
          amount: body.amount,
          paymentMode: body.paymentMode,
          receiptReference: body.receiptReference,
          periodLabel: body.periodLabel,
          invoiceNumber,
          totalWithGst,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Payment recorded successfully',
      invoiceNumber,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to record payment';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
